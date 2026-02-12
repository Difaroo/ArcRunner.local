import { PrismaClient } from '@prisma/client';
import type { Prisma } from '@prisma/client';

const prisma = new PrismaClient({
    log: ['query', 'info', 'warn', 'error'],
});

const GLOBAL_VIBES = [
    // --- CAMERAS ---
    { title: 'Ultra-wide 14mm', prompt: 'Intense ultra-wide perspective on a 14mm lens, extreme distortion and vast ENVIRONMENT.', type: 'CAMERA' },
    { title: 'Superwide 18mm', prompt: 'Dramatic superwide angle using an 18mm lens, exaggerated perspective and depth in the scene.', type: 'CAMERA' },
    { title: 'Wide 24mm', prompt: 'Expansive scene captured on a 24mm wide-angle lens, dramatic perspective emphasizing the ENVIRONMENT.', type: 'CAMERA' },
    { title: 'Wide 28mm', prompt: 'Broad establishing shot with a 28mm lens, balanced width and minimal distortion around the SUBJECT.', type: 'CAMERA' },
    { title: 'Prime 35mm', prompt: 'Wide-normal view through a 35mm prime lens, dynamic framing of the SUBJECT with slight environmental context.', type: 'CAMERA' },
    { title: 'Prime 40mm', prompt: 'Intimate 40mm prime lens view, subtle wide-normal look with clean framing of the SUBJECT.', type: 'CAMERA' },
    { title: 'Prime 50mm', prompt: 'Cinematic shot using a 50mm prime lens, natural human-eye perspective on the FOCUS with shallow depth of field.', type: 'CAMERA' },
    { title: 'Prime 75mm', prompt: 'Medium telephoto 75mm prime lens, soft portrait-style separation of the FOCUS.', type: 'CAMERA' },
    { title: 'Prime 85mm', prompt: 'Portrait shot on an 85mm prime lens, compressed background and creamy bokeh isolating the FOCUS.', type: 'CAMERA' },
    { title: 'Telephoto 100mm', prompt: 'Tight telephoto view on a 100mm lens, strong background compression highlighting the FOCUS.', type: 'CAMERA' },
    { title: 'Telephoto 135mm', prompt: 'Extreme compression shot on a 135mm telephoto lens, flattening space around the distant FOCUS.', type: 'CAMERA' },
    { title: 'Telephoto 200mm', prompt: 'Extreme reach with a 200mm telephoto lens, heavily compressed and isolated distant SUBJECT.', type: 'CAMERA' },
    { title: 'Super Telephoto 300mm+', prompt: 'Extreme long-distance shot on a SUPER TELEPHOTO lens, maximum compression and isolation.', type: 'CAMERA' },
    { title: 'Zoom 16-35mm', prompt: 'Ultra-wide to wide zoom 16-35mm lens, flexible framing of expansive landscapes or interiors.', type: 'CAMERA' },
    { title: 'Zoom 24-70mm', prompt: 'Versatile footage shot on a 24-70mm zoom lens, smooth focal transitions from wide to medium on the SUBJECT.', type: 'CAMERA' },
    { title: 'Zoom 70-200mm', prompt: 'Long-range telephoto zoom 70-200mm lens, isolated SUBJECT with heavy background compression.', type: 'CAMERA' },
    { title: 'Fisheye', prompt: 'Full fisheye distortion using a FISHEYE lens, 180-degree curved view of the scene.', type: 'CAMERA' },
    { title: 'Macro 100mm', prompt: 'Extreme close-up detail shot on a 100mm macro lens, sharp textures and shallow depth on the FOCUS.', type: 'CAMERA' },
    { title: 'Tilt-Shift', prompt: 'Controlled perspective with a tilt-shift lens, selective focus and miniature effect on the SUBJECT.', type: 'CAMERA' },
    { title: 'Anamorphic 40mm', prompt: 'Cinematic anamorphic look on a 40mm anamorphic lens, oval bokeh and wide aspect on the FOCUS.', type: 'CAMERA' },

    // --- MOVEMENTS ---
    { title: 'Pan', prompt: 'Smooth horizontal pan from LEFT to RIGHT, revealing the scene gradually.', type: 'MOVEMENT' },
    { title: 'Tilt', prompt: 'Slow vertical tilt from DOWN to UP, emphasizing height and scale.', type: 'MOVEMENT' },
    { title: 'Zoom', prompt: 'Gradual zoom in from WIDE to TIGHT on the FOCUS, building intensity.', type: 'MOVEMENT' },
    { title: 'Dolly In/Out', prompt: 'Smooth dolly move DIRECTION (in/out) toward/away from the FOCUS at SPEED speed.', type: 'MOVEMENT' },
    { title: 'Tracking Shot', prompt: 'Lateral tracking shot following the SUBJECT at SPEED speed, maintaining distance.', type: 'MOVEMENT' },
    { title: 'Handheld', prompt: 'Shaky handheld camera following the SUBJECT with natural instability and SPEED motion.', type: 'MOVEMENT' },
    { title: 'Push In', prompt: 'Deliberate push in toward the FOCUS at SPEED speed, increasing emotional intensity.', type: 'MOVEMENT' },
    { title: 'Pull Out', prompt: 'Slow pull out from the FOCUS, revealing more of the ENVIRONMENT.', type: 'MOVEMENT' },
    { title: 'Steadicam', prompt: 'Smooth Steadicam follow of the SUBJECT through the scene at SPEED speed.', type: 'MOVEMENT' },
    { title: 'Crane/Jib', prompt: 'Crane/jib movement DIRECTION (up/down) over the FOCUS, revealing from HEIGHT angle.', type: 'MOVEMENT' },
    { title: 'Pedestal Up/Down', prompt: 'Pedestal move DIRECTION (up/down) changing camera height on the FOCUS.', type: 'MOVEMENT' },
    { title: 'Aerial/Drone', prompt: 'Aerial drone shot orbiting/flying DIRECTION around the FOCUS at HEIGHT altitude.', type: 'MOVEMENT' },
    { title: 'Whip Pan', prompt: 'Fast whip pan DIRECTION (left/right) with motion blur transition.', type: 'MOVEMENT' },
    { title: 'Follow Shot', prompt: 'Camera follows behind/ahead of the SUBJECT at SPEED speed through the scene.', type: 'MOVEMENT' },
    { title: 'Arc', prompt: 'Smooth arc movement DIRECTION around the FOCUS at SPEED speed.', type: 'MOVEMENT' },
    { title: 'Orbit', prompt: 'Continuous slow DEGREES-degree orbit around the FOCUS, DIRECTION direction.', type: 'MOVEMENT' },
    { title: 'Boom', prompt: 'Boom movement DIRECTION (up/down) over the FOCUS with sweeping motion.', type: 'MOVEMENT' },
    { title: 'Dolly Zoom', prompt: 'Dolly zoom DIRECTION (in/out) while adjusting focal length for vertigo effect on the FOCUS.', type: 'MOVEMENT' },
    { title: 'Roll', prompt: 'Camera roll DEGREES degrees DIRECTION (clockwise/counterclockwise) around the axis.', type: 'MOVEMENT' },
    { title: 'Crash Zoom', prompt: 'Abrupt crash zoom DIRECTION (in/out) to/from the FOCUS with high SPEED.', type: 'MOVEMENT' },
];

async function seed() {
    console.log('🌱 Seeding Global Vibes (Camera & Movement)...');

    // Clear existing global vibes to ensure list matches exactly
    await prisma.vibe.deleteMany({
        where: {
            seriesId: null as any
        }
    });

    for (const vibe of GLOBAL_VIBES) {
        await prisma.vibe.create({
            data: {
                title: vibe.title,
                prompt: vibe.prompt,
                type: vibe.type,
                // seriesId: null, // Default
                sortOrder: 0
            } as any
        });
        console.log(`✅ Created: [${vibe.type}] ${vibe.title}`);
    }

    console.log('✨ Global Seeding Complete.');
}

seed()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
