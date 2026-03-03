import { db } from '@/lib/db';
import fs from 'fs';
import path from 'path';
import { GenerateTaskInput } from '@/lib/generate-manager';
import { resolveManifest, LibraryContext } from '@/lib/structural-manifest';
import { getModelConfig } from '@/lib/models';

export interface ResolutionContext {
    effectiveModelId: string;
    apiType: string;
    builderId: string;
    manifest: any;
    dbClip: any;
    libraryItems: any[];
    descriptors: {
        styleName: string;
        styleDescription: string;
        styleNegatives: string;
        subjectDescription: string;
        subjectNegatives: string;
        locationAsset?: any;
        characterAssets?: any[];
        styleAsset?: any;
        cameraAsset?: any;
    };
    modifiedInput: GenerateTaskInput; // To pass back any cleaned up fields like dialog/action
}

export class AssetResolver {

    public static async resolve(input: GenerateTaskInput): Promise<ResolutionContext> {
        let effectiveModelId = input.model;

        if (!effectiveModelId && input.clip.episodeId) {
            try {
                const ep = await db.episode.findUnique({
                    where: { id: input.clip.episodeId },
                    select: { model: true }
                });
                if (ep?.model) {
                    effectiveModelId = ep.model;
                }
            } catch (err) {
                console.warn('[AssetResolver] Failed to fetch episode model:', err);
            }
        }

        const config = getModelConfig(effectiveModelId);
        const apiType = config.apiStrategy;
        const builderId = config.builderId;
        const isImageModel = (apiType === 'flux' || apiType === 'nano');

        if (isImageModel) {
            if (input.clip.dialog) {
                input.clip.dialog = "";
            }

            if (input.startFrame) {
                const originalAction = input.clip.action || "";
                const sentences = originalAction.match(/[^.!?]+[.!?]+/g);
                if (sentences && sentences.length > 0) {
                    const firstSentence = sentences[0].trim();
                    input.clip.action = firstSentence;

                    if (input.clip.character) {
                        const originalChars = input.clip.character.split(',').map(s => s.trim()).filter(Boolean);
                        const filteredChars = originalChars.filter(charName => {
                            const actionText = firstSentence.toLowerCase();
                            const fullCharName = charName.toLowerCase();
                            if (actionText.includes(fullCharName)) return true;
                            const rootName = fullCharName.split('(')[0].trim();
                            if (rootName.length > 2 && actionText.includes(rootName)) return true;
                            return false;
                        });

                        if (filteredChars.length !== originalChars.length) {
                            if (!(filteredChars.length === 0 && originalChars.length > 0)) {
                                input.clip.character = filteredChars.join(', ');
                            }
                        }
                    }
                }
            }
        }

        const dbClip = await db.clip.findUnique({
            where: { id: parseInt(String(input.clipId)) },
            include: {
                modelInputSlots: {
                    include: {
                        media: true,
                        studioItem: {
                            include: {
                                media: {
                                    orderBy: { createdAt: 'desc' as const },
                                    take: 1
                                }
                            }
                        }
                    },
                    orderBy: { sortOrder: 'asc' }
                }
            }
        });

        if (!dbClip) throw new Error(`Clip ID ${input.clipId} not found in DB`);

        // Inject frontend MIS state over DB state to support unsaved S2E overrides and drag/drop
        const frontendSlots = (input.clip as any).modelInputSlots;
        let sortedSlots = (dbClip as any).modelInputSlots || [];

        if (frontendSlots && frontendSlots.length > 0) {
            sortedSlots = frontendSlots.map((fSlot: any) => {
                // If it's a drag-drop unsaved slot, it lacks rich media/studioItem, but `url` might exist directly
                const matchedDbSlot = sortedSlots.find((dSlot: any) => dSlot.id === fSlot.id);
                return matchedDbSlot ? { ...matchedDbSlot, ...fSlot } : fSlot;
            }).sort((a: any, b: any) => (a.sortOrder || 0) - (b.sortOrder || 0));
        }

        const libraryItems = await db.studioItem.findMany({
            where: { seriesId: input.seriesId },
            include: {
                media: {
                    orderBy: { createdAt: 'desc' },
                    take: 1
                }
            }
        });

        const seriesLib: Record<string, string> = {};
        libraryItems.forEach(item => {
            const mediaUrl = (item.media && item.media.length > 0) ? item.media[0].url : item.refImageUrl;
            if (item.name && mediaUrl) {
                seriesLib[item.name.toLowerCase()] = mediaUrl;
            }
        });

        const findLib = (name: string) => {
            if (!name) return undefined;
            const k = name.toLowerCase().trim();
            return seriesLib[k] || seriesLib[k.replace(/ /g, '_')] || seriesLib[k.replace(/_/g, ' ')];
        };

        const styleItemUrl = findLib(input.clip.style || "");
        const locItemUrl = findLib(input.clip.location || "");
        const locationImages = locItemUrl ? [locItemUrl] : [];

        const charNames = input.clip.character ? input.clip.character.split(',') : [];
        const characterImages = charNames
            .map(n => findLib(n.trim()))
            .filter((url): url is string => !!url);

        const libraryContext: LibraryContext = {
            styleImage: styleItemUrl,
            locationImages,
            characterImages
        };

        const formattedExplicitRefs = sortedSlots
            .map((slot: any) => {
                const m = slot.media;
                const s = slot.studioItem;

                let url = null;
                if (m) {
                    url = (m.url && m.url.startsWith('http')) ? m.url : m.localPath || m.url;
                } else if (s) {
                    const sm = s.media && s.media.length > 0 ? s.media[0] : null;
                    if (sm) {
                        url = (sm.url && sm.url.startsWith('http')) ? sm.url : sm.localPath || sm.url;
                    } else {
                        url = s.refImageUrl || s.thumbnailPath;
                    }
                }

                if (!url || url.length < 5) return null;
                return {
                    id: m?.id || s?.id?.toString() || `slot-${slot.sortOrder}`,
                    url,
                    refImageSort: slot.sortOrder
                };
            })
            .filter(Boolean) as any;

        const manifest = resolveManifest(dbClip as any, effectiveModelId || 'veo-fast', libraryContext, formattedExplicitRefs);

        const findItem = (name: string, type: string) => {
            if (!name) return undefined;
            return libraryItems.find(i => i.name?.trim().toLowerCase() === name?.trim().toLowerCase() && i.type === type);
        }

        const styleName = input.clip.style || "";
        const styleItem = findItem(styleName, 'LIB_STYLE');
        const styleDescription = styleItem?.description || "";
        const styleNegatives = styleItem?.negatives || "";

        const charItems = charNames.map((n: string) => findItem(n.trim(), 'LIB_CHARACTER')).filter((i: any) => i);
        const locName = input.clip.location || "";
        const locItem = findItem(locName, 'LIB_LOCATION');
        const camName = input.clip.camera || "";
        const camItem = findItem(camName, 'LIB_CAMERA');

        const parts = [];
        if (locItem?.description) {
            const nameLabel = locName ? `LOCATION: ${locName}: ` : 'LOCATION: ';
            parts.push(`${nameLabel}At ${locItem.description}`);
        } else if (locName) parts.push(`LOCATION: ${locName}: At ${locName}`);

        if (charItems.length > 0) parts.push(charItems.map((i: any) => i.description || i.name).join(' and '));
        else if (input.clip.character) parts.push(input.clip.character);

        if (input.clip.action) parts.push(`ACTION: ${input.clip.action}`);
        if (input.clip.dialog) parts.push(`Character says: "${input.clip.dialog}"`);

        if (camItem?.description) parts.push(`${camItem.description} shot.`);
        else if (camName) parts.push(`${camName} shot.`);

        if (input.clip.movement) parts.push(`MOVEMENT: ${input.clip.movement}`);

        const subjectDescription = parts.join('. ');
        const subjectNegatives = [
            ...charItems.map((i: any) => i.negatives),
            locItem?.negatives,
            camItem?.negatives
        ].filter(Boolean).join('. ');

        return {
            effectiveModelId: effectiveModelId || 'veo-fast',
            apiType,
            builderId,
            manifest,
            dbClip,
            libraryItems,
            modifiedInput: input,
            descriptors: {
                styleName: styleItem ? styleName : "",
                styleDescription,
                styleNegatives,
                subjectDescription,
                subjectNegatives,
                locationAsset: locItem ? { name: locName, description: locItem.description || "", negatives: locItem.negatives || "" } : undefined,
                characterAssets: charItems.map((c: any) => ({
                    name: c.name,
                    description: c.description || "",
                    negatives: c.negatives || "",
                    refImageUrl: c.refImageUrl || undefined
                })),
                styleAsset: styleItem ? { description: styleItem.description || "", negatives: styleItem.negatives || "" } : undefined,
                cameraAsset: camItem ? { description: camItem.description || "", negatives: camItem.negatives || "" } : undefined
            }
        };
    }
}
