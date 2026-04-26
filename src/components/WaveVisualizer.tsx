interface Props {
  active: boolean
}

export default function WaveVisualizer({ active }: Props) {
  return (
    <div className="flex items-center gap-1 h-10">
      {Array.from({ length: 7 }).map((_, i) => (
        <div
          key={i}
          className={`
            w-1 rounded-full transition-colors duration-300
            ${active ? 'bg-green-400 wave-bar' : 'bg-white/20'}
          `}
          style={{
            height: active ? `${20 + Math.random() * 20}px` : '8px',
            animationDelay: `${i * 0.1}s`,
          }}
        />
      ))}
    </div>
  )
}
