import { cookies } from "next/headers";

import { Workspace } from "@/components/workspace/workspace";
import { PANELS_COOKIE, parsePanels } from "@/components/workspace/panels";
import { db } from "@/lib/db";
import { loadSnapshot } from "@/lib/queries";

export default async function HomePage() {
  // Reading cookies makes the page dynamic, so the snapshot is always fresh.
  const panels = parsePanels((await cookies()).get(PANELS_COOKIE)?.value);
  return <Workspace initial={loadSnapshot(db)} initialPanels={panels} />;
}
