import { NextRequest, NextResponse } from "next/server";
import { readdir, stat } from "node:fs/promises";
import { join, dirname, resolve } from "node:path";
import { homedir } from "node:os";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    let targetPath: string = body.path || homedir();

    // Resolve to absolute
    targetPath = resolve(targetPath);

    const stats = await stat(targetPath).catch(() => null);
    if (!stats || !stats.isDirectory()) {
      return NextResponse.json(
        { error: "Directory not found" },
        { status: 400 },
      );
    }

    const entries = await readdir(targetPath, { withFileTypes: true });

    const items: Array<{
      name: string;
      type: "directory" | "file";
      path: string;
    }> = [];

    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue; // skip hidden

      if (entry.isDirectory()) {
        items.push({
          name: entry.name,
          type: "directory",
          path: join(targetPath, entry.name),
        });
      } else if (entry.isFile() && entry.name.endsWith(".md")) {
        items.push({
          name: entry.name,
          type: "file",
          path: join(targetPath, entry.name),
        });
      }
    }

    // Sort: directories first, then files, alphabetically within each
    items.sort((a, b) => {
      if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    const parent = dirname(targetPath);

    return NextResponse.json({
      currentPath: targetPath,
      parentPath: parent !== targetPath ? parent : null,
      entries: items,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to browse directory";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
