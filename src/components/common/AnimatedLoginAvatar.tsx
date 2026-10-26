import React from 'react';

interface AnimatedLoginAvatarProps {
  isTypingPassword?: boolean;
}

export const AnimatedLoginAvatar: React.FC<AnimatedLoginAvatarProps> = ({
  isTypingPassword = false,
}) => {
  return (
    <div className="relative w-full max-w-[280px] mx-auto h-36 flex flex-col items-center justify-end select-none overflow-hidden pb-1">
      {/* Background Ambience */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-36 h-36 bg-emerald-400/20 rounded-full blur-2xl animate-pulse" />
      </div>

      {/* Walking Character Container */}
      <div className="relative z-10 flex flex-col items-center animate-[bounce_1.4s_infinite_ease-in-out]">
        {/* Interactive Speech Bubble */}
        <div className="mb-1 px-3 py-1 rounded-full bg-emerald-950/90 border border-emerald-400/40 text-[10px] font-bold text-emerald-200 shadow-md backdrop-blur-xs flex items-center gap-1.5 animate-[pulse_2s_infinite]">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping inline-block" />
          <span>
            {isTypingPassword
              ? 'Ssst.. jangan intip kata sandi!'
              : 'Selamat Datang, Pendidik Hebat!'}
          </span>
        </div>

        {/* SVG Animated Character */}
        <div className="relative w-20 h-20">
          <svg
            viewBox="0 0 120 120"
            className="w-full h-full drop-shadow-md"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <ellipse
              cx="60"
              cy="114"
              rx="24"
              ry="5"
              fill="rgba(0, 0, 0, 0.25)"
              className="animate-[pulse_1.4s_infinite]"
            />
            {/* Left Leg */}
            <g className="origin-top animate-[spin_1.2s_infinite_alternate_ease-in-out]" style={{ transformOrigin: '54px 85px' }}>
              <path
                d="M54 85 L52 106 L46 109"
                stroke="#0f766e"
                strokeWidth="5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <ellipse cx="46" cy="109" rx="6" ry="3.5" fill="#042f2e" />
            </g>
            {/* Right Leg */}
            <g className="origin-top animate-[spin_1.2s_infinite_alternate-reverse_ease-in-out]" style={{ transformOrigin: '66px 85px' }}>
              <path
                d="M66 85 L68 106 L74 109"
                stroke="#0f766e"
                strokeWidth="5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <ellipse cx="74" cy="109" rx="6" ry="3.5" fill="#042f2e" />
            </g>
            {/* Body */}
            <path
              d="M48 56 C48 56 42 70 44 85 C44 87 76 87 76 85 C78 70 72 56 72 56 Z"
              fill="url(#bodyGradient)"
              stroke="#065f46"
              strokeWidth="2"
            />
            {/* White Collar */}
            <path d="M55 56 L60 66 L65 56 Z" fill="#ffffff" />
            <circle cx="60" cy="71" r="1.5" fill="#f59e0b" />
            <circle cx="60" cy="77" r="1.5" fill="#f59e0b" />
            {/* Arms */}
            <path
              d="M48 60 Q38 72 45 80"
              stroke="#047857"
              strokeWidth="4.5"
              strokeLinecap="round"
            />
            <rect
              x="36"
              y="74"
              width="14"
              height="12"
              rx="2"
              transform="rotate(-15 36 74)"
              fill="#f59e0b"
              stroke="#b45309"
              strokeWidth="1.5"
            />
            <path
              d="M72 60 Q82 70 76 78"
              stroke="#047857"
              strokeWidth="4.5"
              strokeLinecap="round"
            />
            <circle cx="76" cy="79" r="3" fill="#fed7aa" />
            {/* Head */}
            <circle cx="60" cy="40" r="16" fill="#fde68a" stroke="#f59e0b" strokeWidth="1.5" />
            {/* Peci / Topi */}
            <path
              d="M45 34 C45 23 75 23 75 34 Z"
              fill="#064e3b"
              stroke="#042f2e"
              strokeWidth="1.5"
            />
            <path
              d="M44.5 33 C53 31 67 31 75.5 33"
              stroke="#fbbf24"
              strokeWidth="2"
              strokeLinecap="round"
            />
            {/* Face */}
            {isTypingPassword ? (
              <>
                <path d="M52 40 Q55 43 58 40" stroke="#1f2937" strokeWidth="2" strokeLinecap="round" fill="none" />
                <path d="M62 40 Q65 43 68 40" stroke="#1f2937" strokeWidth="2" strokeLinecap="round" fill="none" />
                <circle cx="51" cy="43" r="2.5" fill="#fca5a5" opacity="0.8" />
                <circle cx="69" cy="43" r="2.5" fill="#fca5a5" opacity="0.8" />
                <path d="M58 47 Q60 49 62 47" stroke="#b91c1c" strokeWidth="1.5" strokeLinecap="round" fill="none" />
              </>
            ) : (
              <>
                <ellipse cx="54" cy="39" rx="2.5" ry="3.5" fill="#111827" />
                <circle cx="55" cy="38" r="1" fill="#ffffff" />
                <ellipse cx="66" cy="39" rx="2.5" ry="3.5" fill="#111827" />
                <circle cx="67" cy="38" r="1" fill="#ffffff" />
                <path
                  d="M55 45 Q60 50 65 45"
                  stroke="#991b1b"
                  strokeWidth="2"
                  strokeLinecap="round"
                  fill="none"
                />
                <circle cx="50" cy="43" r="2.5" fill="#fda4af" opacity="0.7" />
                <circle cx="70" cy="43" r="2.5" fill="#fda4af" opacity="0.7" />
              </>
            )}
            <defs>
              <linearGradient id="bodyGradient" x1="48" y1="56" x2="72" y2="87" gradientUnits="userSpaceOnUse">
                <stop stopColor="#059669" />
                <stop offset="1" stopColor="#047857" />
              </linearGradient>
            </defs>
          </svg>
        </div>
      </div>
    </div>
  );
};
