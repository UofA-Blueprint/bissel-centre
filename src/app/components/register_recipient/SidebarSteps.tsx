import React from "react";
import { History as HistoryIcon } from "lucide-react";

type Props = {
  currentPage: number;
  goToStep: (step: number) => void;
  completedSteps: Set<number>;
  steps?: Array<{ id: number; label: string }>;
  separateStep?: { id: number; label: string };
  className?: string;
};

export default function SidebarSteps({
  currentPage,
  goToStep,
  completedSteps,
  steps = [
    { id: 1, label: "Personal Details" },
    { id: 2, label: "Additional Information" },
    { id: 3, label: "Upload Photo" },
    { id: 4, label: "Review" },
  ],
  separateStep,
  className,
}: Props) {
  return (
    <aside
      className={`md:col-span-1 space-y-2 text-sm border-r-2 font-medium p-4 pr-8 ${
        className ?? ""
      }`}
    >
      <ul className="text-sm">
        {steps.map((s) => {
          const isCompleted = completedSteps.has(s.id);

          return (
            <li
              key={s.id}
              className="flex cursor-pointer items-center rounded-lg p-2 hover:bg-gray-100"
              onClick={() => goToStep(s.id)}
            >
              <span
                className={`inline-flex items-center justify-center w-7 h-6 rounded-full text-xs font-semibold mr-1 ${
                  isCompleted
                    ? "bg-green-500 text-white"
                    : "bg-primary text-white"
                }`}
              >
                {isCompleted ? "✓" : s.id}
              </span>

              <div
                className={`${
                  currentPage === s.id ? "bg-lightBlue" : ""
                } w-full pl-2 py-2 rounded-lg text-left`}
              >
                <span>{s.label}</span>
              </div>
            </li>
          );
        })}
      </ul>

      {separateStep && (
        <button
          type="button"
          onClick={() => goToStep(separateStep.id)}
          className={`mt-4 flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm font-semibold transition-colors ${
            currentPage === separateStep.id
              ? "border-primary bg-lightBlue text-primary"
              : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
          }`}
        >
          <HistoryIcon className="h-4 w-4" />
          {separateStep.label}
        </button>
      )}
    </aside>
  );
}
