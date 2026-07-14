export function Spinner({ className = "" }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={`inline-block h-4 w-4 animate-spin-slow rounded-full border-2 border-current border-t-transparent align-[-2px] opacity-70 ${className}`}
    />
  );
}
