import React from "react";

export default function BirdAnimation() {
  const birds = [
    { top: "12%", width: "28px", duration: "28s", delay: "0s" },
    { top: "25%", width: "22px", duration: "22s", delay: "6s" },
    { top: "38%", width: "18px", duration: "35s", delay: "12s" },
    { top: "55%", width: "24px", duration: "25s", delay: "3s" },
    { top: "70%", width: "20px", duration: "30s", delay: "18s" },
  ];

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        overflow: "hidden",
        zIndex: 0,
      }}
    >
      <style>
        {`
          @keyframes flyAcross {
            from {
              transform: translateX(-80px);
            }
            to {
              transform: translateX(110vw);
            }
          }
        `}
      </style>
      {birds.map((bird, index) => (
        <svg
          key={index}
          style={{
            position: "absolute",
            top: bird.top,
            width: bird.width,
            animation: `flyAcross linear infinite`,
            animationDuration: bird.duration,
            animationDelay: bird.delay,
            fill: "none",
            stroke: "var(--brown-light)",
            strokeWidth: 2,
            opacity: 0.35,
          }}
          viewBox="0 0 32 16"
        >
          <path d="M0,8 Q8,0 16,8 Q24,0 32,8" />
        </svg>
      ))}
    </div>
  );
}
