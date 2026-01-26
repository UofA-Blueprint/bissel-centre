import React from "react";

type Props = {
  currentPage: number;
  goToStep: (step: number) => void;
  className?: string;
};

export default function SidebarSteps({
  currentPage,
  goToStep,
  className,
}: Props) {
  const steps = [
    { id: 1, label: "Personal Details" },
    { id: 2, label: "Additional Information" },
    { id: 3, label: "Upload Photo" },
    { id: 4, label: "Review" },
  ];

  return (
    <aside
      className={`md:col-span-1 space-y-2 text-sm border-r-2 font-medium p-4 pr-8 ${
        className ?? ""
      }`}
    >
      <ul className="text-sm">
        {steps.map((s) => (
          <li
            key={s.id}
            className="flex items-center cursor-pointer hover:bg-gray-100 p-2 rounded-lg"
            onClick={() => goToStep(s.id)}
          >
            <span className="inline-flex items-center justify-center w-7 h-6 rounded-full bg-primary text-white text-xs font-semibold mr-1">
              {s.id}
            </span>

            <div
              className={`${
                currentPage === s.id ? "bg-lightBlue" : ""
              } w-full pl-2 py-2 rounded-lg text-left`}
            >
              <span>{s.label}</span>
            </div>
          </li>
        ))}
      </ul>
    </aside>
  );
}
