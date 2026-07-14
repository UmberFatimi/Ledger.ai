export function AnimatedBackground() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-zinc-50 dark:bg-black"
    >
      {/* Large pentagon, top-left */}
      <div
        className="animate-float-a absolute -top-16 -left-20 h-[380px] w-[380px] bg-brand-teal opacity-[0.08] dark:opacity-[0.16]"
        style={{ clipPath: "polygon(50% 0%, 100% 38%, 82% 100%, 18% 100%, 0% 38%)" }}
      />

      {/* Triangle, top-right */}
      <div
        className="animate-float-b absolute top-[8%] right-[8%] h-[160px] w-[160px] bg-brand-navy opacity-[0.06] dark:bg-brand-teal dark:opacity-[0.18]"
        style={{ clipPath: "polygon(50% 0%, 100% 100%, 0% 100%)" }}
      />

      {/* Circle, bottom-left */}
      <div className="animate-float-c absolute bottom-[6%] left-[10%] h-[200px] w-[200px] rounded-full bg-brand-emerald opacity-[0.10] dark:opacity-[0.20]" />

      {/* Small accent circle, mid-right */}
      <div className="animate-float-b absolute top-[42%] right-[18%] h-[56px] w-[56px] rounded-full bg-brand-teal opacity-[0.25] dark:opacity-[0.35]" />

      {/* Diamond, bottom-right */}
      <div
        className="animate-float-a absolute -right-16 -bottom-24 h-[260px] w-[260px] bg-brand-navy opacity-[0.05] dark:bg-brand-navy-2 dark:opacity-[0.15]"
        style={{ clipPath: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)" }}
      />

      {/* Small triangle, lower-center */}
      <div
        className="animate-float-c absolute bottom-[18%] left-[45%] h-[90px] w-[90px] bg-brand-emerald opacity-[0.14] dark:opacity-[0.22]"
        style={{ clipPath: "polygon(50% 0%, 100% 100%, 0% 100%)" }}
      />
    </div>
  );
}
