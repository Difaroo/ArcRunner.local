#!/usr/bin/env python3
"""Generate StreamDeck profile with colored buttons - v2 with correct format."""

import json
import os
import uuid
import zipfile
import struct
import zlib
from pathlib import Path

# Output directory
OUTPUT_DIR = Path("/Users/davidfennell/.gemini/antigravity/workspaces/arcrunner-local/streamdeck_export_v2")
if OUTPUT_DIR.exists():
    import shutil
    shutil.rmtree(OUTPUT_DIR)
OUTPUT_DIR.mkdir(exist_ok=True)

# Colors (hex RGB)
COLORS = {
    "green": (0, 255, 0),
    "yellow": (255, 204, 0),
    "red": (255, 51, 51),
    "cyan": (0, 204, 255),
    "white": (255, 255, 255),
}

# Button definitions: (title, prompt, color)
PAGE1_BUTTONS = {
    "0,0": ("PLAN", "Feature: [NAME]. Analyze requirements, flag risks, output plan. No implementation.", "cyan"),
    "1,0": ("BUILD", "Build: [FEATURE]. Defensive, modular, type-safe. On error: debug + fix.", "green"),
    "2,0": ("REVIEW", "Review: [COMPONENT]. Walkthrough, control flow, data flow, edge cases. Fix issues.", "yellow"),
    "3,0": ("TEST", "Pre-flight: tsc, lint, build. Run tests. On failure: root cause + fix.", "yellow"),
    "0,1": ("QUICK\nFIX", "Fix: [ISSUE]. Execute directly. Pre-flight when done.", "green"),
    "1,1": ("FEATURE", "Feature: [NAME]. Standard: plan → build → review → test → ship.", "cyan"),
    "2,1": ("EPIC", "Epic: [NAME]. Arch audit, phased milestones, iterate per phase.", "cyan"),
    "3,1": ("DEBUG", "Debug: [PROBLEM]. What tried, why failed, research solution. Plan only.", "red"),
    "4,1": ("DISCUSS", "Discussion only. No execution. Facts and ideas.", "cyan"),
    "0,2": ("PRE\nFLIGHT", "Run: tsc, lint, build. Fix errors. Report when done.", "red"),
    "1,2": ("RESTART", "cd /Users/davidfennell/.gemini/antigravity/workspaces/arcrunner-local\n\nnpx -y kill-port 3000 3001\n\nnpm run dev:lan", "white"),
    "2,2": ("DEV", "cd /Users/davidfennell/.gemini/antigravity/workspaces/arcrunner-local && npm run dev", "white"),
    "3,2": ("SHIP", "Ship: tests pass, version bump, HISTORY.md, commit + push.", "green"),
}

PAGE2_BUTTONS = {
    "0,0": ("UI\nREVIEW", "Review UI: [PAGE]. Components, styling, state, performance.", "yellow"),
    "1,0": ("API\nREVIEW", "Review API: [ENDPOINT]. Contract, OpenAPI, error handling.", "yellow"),
    "2,0": ("STACK", "Stack review: Next.js, React, TS, Tailwind. Structure + patterns.", "yellow"),
    "3,0": ("ARCHITECT", "Arch audit: [FEATURE]. Structure, coupling, tech debt.", "cyan"),
    "0,1": ("REGRESS", "Full regression suite. On failure: root cause + fix.", "yellow"),
    "1,1": ("SMOKE\nUI", "Quick UI smoke: [FEATURE] works visually.", "yellow"),
    "2,1": ("SMOKE\nAPI", "Quick API smoke: [ENDPOINT] responds.", "yellow"),
    "3,1": ("CONTRACT", "Contract verify: API matches spec.", "yellow"),
    "4,1": ("UAT\nSEQ", "Generate test sequence for: [FEATURE].", "yellow"),
    "0,2": ("DEFENSIVE", "Extra defensive: strict validation, comprehensive errors, fail-safe.", "red"),
    "1,2": ("MAINTAIN", "Refactor for maintainability: DRY, simplify, polish.", "cyan"),
    "2,2": ("FACTOR", "Refactor: [COMPONENT]. Preserve logic, incremental changes.", "cyan"),
}

PAGE3_BUTTONS = {
    "0,0": ("COMMIT", "Commit: semver version, HISTORY.md, commit + push.", "green"),
    "1,0": ("PUSH\nPROD", "Push production. Confirm. Migrate DB if needed.", "green"),
    "2,0": ("UPDATE\nDOCS", "Update: User Manual, arch docs, UI version.", "white"),
    "3,0": ("UPDATE\nSPRINT", "Update: Sprint status, Backlog priorities.", "white"),
    "0,1": ("WRITING\nSTYLE", "Use my writing style: Succinct, efficient, simple prose; UK English spelling; No 'm' dashes - use ' - ' dashes; Use \":\" only before lists; Use \"[]\" brackets instead of \"()\"s; Use \" / \" instead of \"/\"; Italics for proper names.", "white"),
}


def create_rgba_png(width: int, height: int, r: int, g: int, b: int, a: int = 255) -> bytes:
    """Create a valid RGBA PNG image."""
    # Raw pixel data with filter bytes
    raw_data = b''
    for y in range(height):
        raw_data += b'\x00'  # Filter type: None
        for x in range(width):
            raw_data += bytes([r, g, b, a])
    
    def png_chunk(chunk_type: bytes, data: bytes) -> bytes:
        chunk = chunk_type + data
        crc = zlib.crc32(chunk) & 0xffffffff
        return struct.pack('>I', len(data)) + chunk + struct.pack('>I', crc)
    
    # PNG signature
    png = b'\x89PNG\r\n\x1a\n'
    
    # IHDR: width, height, bit depth=8, color type=6 (RGBA), compression=0, filter=0, interlace=0
    ihdr_data = struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0)
    png += png_chunk(b'IHDR', ihdr_data)
    
    # IDAT: compressed pixel data
    compressed = zlib.compress(raw_data, 9)
    png += png_chunk(b'IDAT', compressed)
    
    # IEND
    png += png_chunk(b'IEND', b'')
    
    return png


def create_text_action(pos: str, title: str, prompt: str, color: str, images_dir: Path) -> dict:
    """Create a StreamDeck text action."""
    action_id = str(uuid.uuid4())
    # Create image ID matching original format (26 uppercase chars + Z)
    image_id = ''.join(c for c in uuid.uuid4().hex.upper()[:26]) + 'Z'
    
    # Generate and save image
    r, g, b = COLORS.get(color, COLORS["white"])
    png_data = create_rgba_png(144, 144, r, g, b)
    
    image_path = images_dir / f"{image_id}.png"
    image_path.write_bytes(png_data)
    
    return {
        "ActionID": action_id,
        "LinkedTitle": True,
        "Name": "Text",
        "Plugin": {
            "Name": "Text",
            "UUID": "com.elgato.streamdeck.system.text",
            "Version": "1.0"
        },
        "Resources": None,
        "Settings": {
            "Hotkey": {"KeyModifiers": 0, "QTKeyCode": 33554431, "VKeyCode": -1},
            "isSendingEnter": False,
            "isTypingMode": False,
            "pastedText": prompt
        },
        "State": 0,
        "States": [{
            "FontFamily": "Arial",
            "FontSize": 14,
            "FontStyle": "Bold",
            "FontUnderline": False,
            "Image": f"Images/{image_id}.png",
            "OutlineThickness": 0,
            "ShowTitle": True,
            "Title": title,
            "TitleAlignment": "middle",
            "TitleColor": "#000000"
        }],
        "UUID": "com.elgato.streamdeck.system.text"
    }


def create_nav_action(direction: str) -> dict:
    """Create a navigation action (no image needed)."""
    action_id = str(uuid.uuid4())
    
    if direction == "next":
        return {
            "ActionID": action_id,
            "LinkedTitle": True,
            "Name": "Next Page",
            "Plugin": {"Name": "Pages", "UUID": "com.elgato.streamdeck.page", "Version": "1.0"},
            "Resources": None,
            "Settings": {},
            "State": 0,
            "States": [{}],
            "UUID": "com.elgato.streamdeck.page.next"
        }
    else:
        return {
            "ActionID": action_id,
            "LinkedTitle": True,
            "Name": "Previous Page",
            "Plugin": {"Name": "Pages", "UUID": "com.elgato.streamdeck.page", "Version": "1.0"},
            "Resources": None,
            "Settings": {},
            "State": 0,
            "States": [{}],
            "UUID": "com.elgato.streamdeck.page.previous"
        }


def create_page(page_id: str, name: str, buttons: dict, nav_buttons: dict, profile_dir: Path) -> None:
    """Create a page directory with manifest and images."""
    page_dir = profile_dir / "Profiles" / page_id
    images_dir = page_dir / "Images"
    images_dir.mkdir(parents=True, exist_ok=True)
    
    actions = {}
    
    # Add regular buttons
    for pos, (title, prompt, color) in buttons.items():
        actions[pos] = create_text_action(pos, title, prompt, color, images_dir)
    
    # Add nav buttons
    for pos, direction in nav_buttons.items():
        actions[pos] = create_nav_action(direction)
    
    manifest = {
        "Controllers": [{
            "Actions": actions,
            "Type": "Keypad"
        }],
        "Icon": "",
        "Name": name
    }
    
    manifest_path = page_dir / "manifest.json"
    manifest_path.write_text(json.dumps(manifest))


def main():
    # Use fixed UUIDs for consistency
    profile_id = "A1B2C3D4-E5F6-7890-ABCD-EF1234567890"
    profile_name = f"{profile_id}.sdProfile"
    profile_dir = OUTPUT_DIR / "Profiles" / profile_name
    profile_dir.mkdir(parents=True, exist_ok=True)
    
    # Page IDs (lowercase for Pages list, uppercase for directories)
    page1_id = "11111111-1111-1111-1111-111111111111"
    page2_id = "22222222-2222-2222-2222-222222222222"
    page3_id = "33333333-3333-3333-3333-333333333333"
    
    # Create pages (use uppercase for directory names)
    create_page(page1_id.upper(), "Workflow", PAGE1_BUTTONS, {"4,2": "next"}, profile_dir)
    create_page(page2_id.upper(), "Review", PAGE2_BUTTONS, {"4,0": "prev", "4,2": "next"}, profile_dir)
    create_page(page3_id.upper(), "Admin", PAGE3_BUTTONS, {"4,0": "prev"}, profile_dir)
    
    # Main manifest
    main_manifest = {
        "AppIdentifier": "/Applications/Antigravity.app",
        "Device": {
            "Model": "20GBA9901",
            "UUID": "04ed2b77-da54-4d28-829f-21fd2d11171b"
        },
        "Name": "Antigravity v2",
        "Pages": {
            "Current": "00000000-0000-0000-0000-000000000000",
            "Default": page1_id,
            "Pages": [page1_id, page2_id, page3_id]
        },
        "Version": "3.0"
    }
    
    main_manifest_path = profile_dir / "manifest.json"
    main_manifest_path.write_text(json.dumps(main_manifest))
    
    # Create package.json at root level
    package_json = {
        "AppVersion": "7.1.1.22340",
        "DeviceModel": "20GBA9901",
        "DeviceSettings": None,
        "FormatVersion": 1,
        "OSType": "macOS",
        "OSVersion": "26.2.0",
        "RequiredPlugins": [
            "com.elgato.streamdeck.page",
            "com.elgato.streamdeck.system.text"
        ]
    }
    package_path = OUTPUT_DIR / "package.json"
    package_path.write_text(json.dumps(package_json))
    
    # Create ZIP file with correct structure
    zip_path = OUTPUT_DIR.parent / "Antigravity_v2.streamDeckProfile"
    with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zf:
        # Add package.json at root
        zf.write(package_path, "package.json")
        
        # Add all profile files
        for root, dirs, files in os.walk(OUTPUT_DIR / "Profiles"):
            for file in files:
                file_path = Path(root) / file
                arcname = file_path.relative_to(OUTPUT_DIR)
                zf.write(file_path, arcname)
    
    print(f"✅ Created: {zip_path}")
    
    # Copy to Desktop
    import shutil
    desktop_path = Path("/Users/davidfennell/Desktop/Antigravity_v2.streamDeckProfile")
    shutil.copy(zip_path, desktop_path)
    print(f"✅ Copied to: {desktop_path}")


if __name__ == "__main__":
    main()
