export default function Finale({ onDone }: { onDone: () => void; lowPower: boolean }) {
  return (
    <button type="button" className="fixed inset-0 z-40 bg-black text-white" onClick={onDone}>
      finale
    </button>
  )
}
