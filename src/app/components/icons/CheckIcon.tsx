import * as React from "react";

export default function CheckIcon(props: React.SVGProps<SVGSVGElement>) {
  const { className, ...rest } = props;
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
      {...rest}
    >
      <path d="M6 10l3 3 6-6" />
    </svg>
  );
}
