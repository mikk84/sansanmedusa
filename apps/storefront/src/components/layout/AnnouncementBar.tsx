export function AnnouncementBar() {
  return (
    <div className="h-[30px] bg-black flex items-center justify-center gap-6">
      <span className="text-[11px] text-white font-semibold hidden md:block">
        Tasuta kullertarne üle 99 €
      </span>
      <span className="text-white/40 hidden md:block">·</span>
      <span className="text-[11px] text-white font-semibold hidden md:block">
        Tarne 1–2 tööpäeva
      </span>
      <span className="text-white/40 hidden md:block">·</span>
      <span className="text-[11px] text-white font-semibold hidden md:block">
        30-päevane tagastusõigus
      </span>
      <span className="text-[11px] text-white font-semibold">
        Klienditugi ☎ 6 406 405
      </span>
    </div>
  )
}
