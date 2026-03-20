export default function StatusBanner({ type = "ok", children }) {
  return (
    <div className={`fc-status ${type === "ok" ? "ok" : "err"}`}>
      {children}
    </div>
  );
}