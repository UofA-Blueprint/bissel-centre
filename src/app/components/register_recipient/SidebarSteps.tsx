import React from "react";

type Props = {
  currentPage: number;
  goToStep: (step: number) => void;
  completedSteps: Set<number>;
  className?: string;
};

export default function SidebarSteps({
  currentPage,
  goToStep,
  completedSteps,
  className,
}: Props) {
  const steps = [
    { id: 1, label: "Personal Details" },
    { id: 2, label: "Additional Information" },
    { id: 3, label: "Upload Photo" },
    { id: 4, label: "Review" },
  ];

  // All steps are freely navigable — validation happens on Continue and on
  // final submit (with step-labeled errors), not as a navigation gate.
  const isStepClickable = (_stepId: number) => true;

  return (
    <aside
      className={`md:col-span-1 space-y-2 text-sm border-r-2 font-medium p-4 pr-8 ${
        className ?? ""
      }`}
    >
      <ul className="text-sm">
        {steps.map((s) => {
          const isClickable = isStepClickable(s.id);
          const isCompleted = completedSteps.has(s.id);

          return (
            <li
              key={s.id}
              className={`flex items-center p-2 rounded-lg ${
                isClickable
                  ? "cursor-pointer hover:bg-gray-100"
                  : "cursor-not-allowed opacity-50"
              }`}
              onClick={() => goToStep(s.id)}
            >
              <span
                className={`inline-flex items-center justify-center w-7 h-6 rounded-full text-xs font-semibold mr-1 ${
                  isCompleted
                    ? "bg-green-500 text-white"
                    : isClickable
                      ? "bg-primary text-white"
                      : "bg-gray-300 text-gray-500"
                }`}
              >
                {isCompleted ? "✓" : s.id}
              </span>

              <div
                className={`${
                  currentPage === s.id ? "bg-lightBlue" : ""
                } w-full pl-2 py-2 rounded-lg text-left`}
              >
                <span className={isClickable ? "" : "text-gray-400"}>
                  {s.label}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
