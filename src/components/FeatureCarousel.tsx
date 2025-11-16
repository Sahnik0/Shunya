import React, { forwardRef, useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, useMotionValue, type MotionValue, type Variants } from "framer-motion";
import clsx from "clsx";

import { cn } from "@/lib/utils";

type Step = {
  id: string;
  name: string;
  title: string;
  description: string;
};

const steps: readonly Step[] = [
  { id: "1", name: "Step 1", title: "Feature 1", description: "Feature 1 description" },
  { id: "2", name: "Step 2", title: "Feature 2", description: "Feature 2 description" },
  { id: "3", name: "Step 3", title: "Feature 3", description: "Feature 3 description" },
  { id: "4", name: "Step 4", title: "Feature 4", description: "Feature 4 description" },
] as const;

const ANIMATION_PRESETS = {
  fadeInScale: {
    initial: { opacity: 0, scale: 0.95 },
    animate: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.95 },
    transition: { type: "spring", stiffness: 300, damping: 25, mass: 0.5 },
  },
  slideInRight: {
    initial: { opacity: 0, x: 20 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -20 },
    transition: { type: "spring", stiffness: 300, damping: 25, mass: 0.5 },
  },
  slideInLeft: {
    initial: { opacity: 0, x: -20 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: 20 },
    transition: { type: "spring", stiffness: 300, damping: 25, mass: 0.5 },
  },
} as const;

type AnimationPreset = keyof typeof ANIMATION_PRESETS;

interface ImageSet {
  step1light1?: string;
  step1light2?: string;
  step2light1?: string;
  step2light2?: string;
  step3light?: string;
  step4light?: string;
  alt?: string;
}

interface ComponentProps {
  title?: string;
  description?: string;
  bgClass?: string;
  image: ImageSet;
}

function useNumberCycler(totalSteps = 4, interval = 3000) {
  const [currentNumber, setCurrentNumber] = useState(0);
  const timerRef = useRef<number | undefined>();

  const setupTimer = useCallback(() => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      setCurrentNumber((prev) => (prev + 1) % totalSteps);
      setupTimer();
    }, interval);
  }, [interval, totalSteps]);

  const increment = useCallback(() => {
    setCurrentNumber((prev) => (prev + 1) % totalSteps);
    setupTimer();
  }, [setupTimer]);

  useEffect(() => {
    setupTimer();
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [setupTimer]);

  return { currentNumber, increment };
}

function IconCheck({ className, ...props }: React.ComponentProps<"svg">) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor" className={cn("h-3 w-3", className)} {...props}>
      <path d="m229.66 77.66-128 128a8 8 0 0 1-11.32 0l-56-56a8 8 0 0 1 11.32-11.32L96 188.69 218.34 66.34a8 8 0 0 1 11.32 11.32Z" />
    </svg>
  );
}

const stepVariants: Variants = {
  inactive: { scale: 0.8, opacity: 0.5 },
  active: { scale: 1, opacity: 1 },
};

const MotionImg = motion.img;

const FeatureCard: React.FC<{
  bgClass?: string;
  children: React.ReactNode;
  step: number;
}> = ({ bgClass, children, step }) => {
  const [mounted, setMounted] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });

  function handleMouseMove(e: React.MouseEvent) {
    const { left, top } = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setPos({ x: e.clientX - left, y: e.clientY - top });
  }

  useEffect(() => setMounted(true), []);

  return (
    <div
      className="animated-cards relative w-full rounded-[16px]"
      onMouseMove={handleMouseMove}
      style={{ ["--x" as any]: `${pos.x}px`, ["--y" as any]: `${pos.y}px` }}
    >
      <div className={cn("group relative w-full overflow-hidden rounded-3xl border border-black/10 bg-gradient-to-b from-neutral-900/90 to-stone-800 transition duration-300 dark:from-neutral-950/90 dark:to-neutral-800/90", bgClass)}>
        <div className="m-6 min-h-[350px] w-full relative">
          <AnimatePresence mode="wait">
            <motion.div key={step} className="flex w-4/6 flex-col gap-3" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.3 }}>
              <motion.h2 className="text-xl font-bold tracking-tight text-white md:text-2xl" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1, duration: 0.3 }}>
                {steps[step].title}
              </motion.h2>
              <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2, duration: 0.3 }}>
                <p className="text-sm leading-5 text-neutral-300 sm:text-base sm:leading-5 dark:text-zinc-400">{steps[step].description}</p>
              </motion.div>
            </motion.div>
          </AnimatePresence>
          {mounted ? children : null}
        </div>
      </div>
    </div>
  );
};

const Steps: React.FC<{ steps: readonly Step[]; current: number; onChange: (n: number) => void }> = ({ steps: stepData, current, onChange }) => (
  <nav aria-label="Progress" className="flex justify-center px-4">
    <ol className="flex w-full flex-wrap items-start justify-start gap-2 sm:justify-center md:w-10/12 md:divide-y-0" role="list">
      {stepData.map((step, stepIdx) => {
        const isCompleted = current > stepIdx;
        const isCurrent = current === stepIdx;
        const isFuture = !isCompleted && !isCurrent;
        return (
          <motion.li key={`${step.name}-${stepIdx}`} initial="inactive" animate={isCurrent ? "active" : "inactive"} variants={stepVariants} transition={{ duration: 0.3 }} className={cn("relative z-50 rounded-full px-3 py-1 transition-all duration-300 ease-in-out md:flex", isCompleted ? "bg-neutral-500/20" : "bg-neutral-500/10")}>
            <div className={cn("group flex w-full cursor-pointer items-center focus:outline-none focus-visible:ring-2", (isFuture || isCurrent) && "pointer-events-none")} onClick={() => onChange(stepIdx)}>
              <span className="flex items-center gap-2 text-sm font-medium">
                <motion.span className={cn("flex h-4 w-4 shrink-0 items-center justify-center rounded-full duration-300", isCompleted ? "bg-brand-400 text-white dark:bg-brand-400" : isCurrent ? "bg-brand-300/80 text-neutral-400 dark:bg-neutral-500/50" : "bg-brand-300/10 dark:bg-neutral-500/20")} initial={false} animate={{ scale: isCurrent ? 1.2 : 1 }}>
                  {isCompleted ? <div className="h-3 w-3"><IconCheck /></div> : <span className={cn("text-xs", !isCurrent && "text-[#C6EA7E]")}>{stepIdx + 1}</span>}
                </motion.span>
                <motion.span initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className={clsx("text-sm font-medium duration-300", isCompleted ? "text-muted-foreground" : isCurrent ? "text-lime-300 dark:text-lime-500" : "text-neutral-500")}>{step.name}</motion.span>
              </span>
            </div>
          </motion.li>
        );
      })}
    </ol>
  </nav>
);

const defaultClasses = {
  step1img1: "pointer-events-none w-[50%] border border-stone-100/10 transition-all duration-500 dark:border-stone-700/50 rounded-2xl",
  step1img2: "pointer-events-none w-[60%] border border-stone-100/10 dark:border-stone-700/50 transition-all duration-500 overflow-hidden rounded-2xl",
  step2img1: "pointer-events-none w-[50%] border border-stone-100/10 transition-all duration-500 dark:border-stone-700 rounded-2xl overflow-hidden",
  step2img2: "pointer-events-none w-[40%] border border-stone-100/10 dark:border-stone-700 transition-all duration-500 rounded-2xl overflow-hidden",
  step3img: "pointer-events-none w-[90%] border border-stone-100/10 dark:border-stone-700 rounded-2xl transition-all duration-500 overflow-hidden",
  step4img: "pointer-events-none w-[90%] border border-stone-100/10 dark:border-stone-700 rounded-2xl transition-all duration-500 overflow-hidden",
} as const;

export const FeatureCarousel: React.FC<ComponentProps> = ({ image, bgClass, ...props }) => {
  const { currentNumber: step, increment } = useNumberCycler();
  const [isAnimating, setIsAnimating] = useState(false);

  const handleIncrement = () => {
    if (isAnimating) return;
    setIsAnimating(true);
    increment();
  };

  const handleAnimationComplete = () => setIsAnimating(false);

  const renderStepContent = () => {
    switch (step) {
      case 0:
        return (
          <motion.div className="relative w-full h-full" onAnimationComplete={handleAnimationComplete}>
            <MotionImg className={defaultClasses.step1img1} src={image.step1light1} alt={image.alt ?? "step"} style={{ position: "absolute" }} {...ANIMATION_PRESETS.slideInLeft} />
            <MotionImg className={defaultClasses.step1img2} src={image.step1light2} alt={image.alt ?? "step"} style={{ position: "absolute" }} {...ANIMATION_PRESETS.slideInRight} />
          </motion.div>
        );
      case 1:
        return (
          <motion.div className="relative w-full h-full" onAnimationComplete={handleAnimationComplete}>
            <MotionImg className={clsx(defaultClasses.step2img1, "rounded-2xl")} src={image.step2light1} alt={image.alt ?? "step"} style={{ position: "absolute" }} {...ANIMATION_PRESETS.fadeInScale} />
            <MotionImg className={clsx(defaultClasses.step2img2, "rounded-2xl")} src={image.step2light2} alt={image.alt ?? "step"} style={{ position: "absolute" }} {...ANIMATION_PRESETS.fadeInScale} />
          </motion.div>
        );
      case 2:
        return (
          <MotionImg className={clsx(defaultClasses.step3img, "rounded-2xl")} src={image.step3light} alt={image.alt ?? "step"} style={{ position: "absolute" }} {...ANIMATION_PRESETS.fadeInScale} onAnimationComplete={handleAnimationComplete as any} />
        );
      case 3:
        return (
          <motion.div className="absolute left-1/2 top-1/3 flex w-[100%] -translate-x-1/2 -translate-y-[33%] flex-col gap-12 text-center text-2xl font-bold md:w-[60%]" {...ANIMATION_PRESETS.fadeInScale} onAnimationComplete={handleAnimationComplete}>
            <MotionImg className={clsx(defaultClasses.step4img)} src={image.step4light} alt={image.alt ?? "step"} style={{ position: "absolute" }} {...ANIMATION_PRESETS.fadeInScale} />
          </motion.div>
        );
      default:
        return null;
    }
  };

  return (
    <FeatureCard bgClass={bgClass} step={step} {...props}>
      <div className="relative w-full h-[420px] overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div key={step} {...ANIMATION_PRESETS.fadeInScale} className="w-full h-full absolute">
            {renderStepContent()}
          </motion.div>
        </AnimatePresence>
      </div>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="absolute left-[12rem] top-5 z-50 h-full w-full cursor-pointer md:left-0">
        <Steps current={step} onChange={() => {}} steps={steps} />
      </motion.div>
      <motion.div className="absolute right-0 top-0 z-50 h-full w-full cursor-pointer md:left-0" onClick={handleIncrement} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} />
    </FeatureCard>
  );
};

export default FeatureCarousel;
