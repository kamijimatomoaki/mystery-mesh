/**
 * ProgressStepper
 * マルチステップウィザードの進行状況を表示
 */

"use client";

import { motion } from "framer-motion";
import { Check } from "lucide-react";

interface Step {
  id: number;
  label: string;
  description?: string;
}

interface ProgressStepperProps {
  steps: Step[];
  currentStep: number;
  onStepClick?: (step: number) => void;
  className?: string;
}

export function ProgressStepper({
  steps,
  currentStep,
  onStepClick,
  className = "",
}: ProgressStepperProps) {
  return (
    <div className={`w-full ${className}`}>
      <div className="flex items-center justify-between">
        {steps.map((step, index) => {
          const isCompleted = currentStep > step.id;
          const isCurrent = currentStep === step.id;
          const isClickable = onStepClick && (isCompleted || isCurrent);

          return (
            <div key={step.id} className="flex items-center flex-1 last:flex-none">
              {/* ステップサークル */}
              <motion.button
                onClick={() => isClickable && onStepClick?.(step.id)}
                disabled={!isClickable}
                className={`
                  relative flex items-center justify-center
                  w-10 h-10 rounded-full border-2 transition-all
                  ${isCompleted
                    ? "bg-accent-gold border-accent-gold text-ink"
                    : isCurrent
                      ? "bg-transparent border-accent-gold text-accent-gold"
                      : "bg-transparent border-paper/30 text-paper/30"
                  }
                  ${isClickable ? "cursor-pointer hover:scale-105" : "cursor-default"}
                `}
                whileHover={isClickable ? { scale: 1.1 } : {}}
                whileTap={isClickable ? { scale: 0.95 } : {}}
              >
                {isCompleted ? (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 300 }}
                  >
                    <Check className="w-5 h-5" />
                  </motion.div>
                ) : (
                  <span className="text-sm font-bold">{step.id}</span>
                )}
              </motion.button>

              {/* コネクティングライン */}
              {index < steps.length - 1 && (
                <div className="flex-1 mx-2 h-0.5 bg-paper/20 relative overflow-hidden">
                  <motion.div
                    className="absolute inset-0 bg-accent-gold origin-left"
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: isCompleted ? 1 : 0 }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ステップラベル */}
      <div className="flex justify-between mt-2">
        {steps.map((step) => {
          const isCompleted = currentStep > step.id;
          const isCurrent = currentStep === step.id;

          return (
            <div
              key={step.id}
              className={`
                text-center flex-1 last:flex-none
                ${isCurrent
                  ? "text-accent-gold"
                  : isCompleted
                    ? "text-paper/70"
                    : "text-paper/30"
                }
              `}
            >
              <p className="text-xs font-semibold">{step.label}</p>
              {step.description && (
                <p className="text-[10px] mt-0.5 opacity-70">{step.description}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
