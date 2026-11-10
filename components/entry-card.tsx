import { hub } from "@/hub.config.ts";

/** Frame for the pages outside the hub (sign in, set a password, give an AI permission). */
export function EntryCard({ title, text, children }: { title: string; text?: string; children: React.ReactNode }) {
  return (
    <main className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="w-full max-w-[400px]">
        <div className="mb-5 flex items-center gap-2.5">
          <span className="grid size-8 place-items-center rounded-lg bg-accent text-[14px] font-semibold text-white">{hub.name.slice(0, 1).toUpperCase()}</span>
          <span className="text-[16px] font-semibold text-ink">{hub.name}</span>
        </div>
        <div className="card p-6">
          <h1 className="page-title">{title}</h1>
          {text ? <p className="page-subtitle mb-4">{text}</p> : <div className="mb-4" />}
          {children}
        </div>
      </div>
    </main>
  );
}
