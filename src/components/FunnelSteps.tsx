const STEPS = ["Address", "Choose plan", "Your details", "Specialist"];

export function FunnelSteps({ current }: { current: 0 | 1 | 2 | 3 }) {
  return (
    <nav aria-label="Enrollment progress" className="border-b border-slate-200 bg-white">
      <ol className="container-page flex items-center gap-2 overflow-x-auto py-3 text-xs font-semibold sm:gap-4 sm:text-sm">
        {STEPS.map((s, i) => {
          const done = i < current;
          const active = i === current;
          return (
            <li key={s} className="flex shrink-0 items-center gap-2" aria-current={active ? "step" : undefined}>
              <span
                className={`grid h-6 w-6 place-items-center rounded-full text-[11px] ${
                  done ? "bg-mint-600 text-white" : active ? "bg-navy-900 text-white" : "bg-slate-200 text-slate-500"
                }`}
              >
                {done ? "✓" : i + 1}
              </span>
              <span className={active ? "text-navy-900" : done ? "text-slate-700" : "text-slate-400"}>{s}</span>
              {i < STEPS.length - 1 && <span aria-hidden className="mx-1 h-px w-6 bg-slate-200 sm:w-10" />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
