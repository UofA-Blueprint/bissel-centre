"use client";

import React from "react";
import { ArrowLeft } from "lucide-react";

interface PageHeaderProps {
  title?: string;
  showBackButton?: boolean;
  onBackClick?: () => void;
  actions?: React.ReactNode;
}

/**
 * Per-page subheader (back button / title / actions). Pages render this
 * themselves; the global TopNav lives in the (app) layout.
 */
export default function PageHeader({
  title,
  showBackButton = false,
  onBackClick,
  actions,
}: PageHeaderProps) {
  if (!title && !showBackButton && !actions) {
    return null;
  }

  return (
    <div className="bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
        <div className="flex items-center">
          {showBackButton && (
            <button
              onClick={onBackClick}
              className="inline-flex items-center justify-center w-8 h-8 bg-primary/20 text-primary rounded-full mr-3 hover:bg-primary/30"
            >
              <ArrowLeft size={18} />
            </button>
          )}
          {title && (
            <span className="text-gray-900 font-medium text-xl">{title}</span>
          )}
        </div>

        {actions && (
          <div className="flex items-center space-x-3">{actions}</div>
        )}
      </div>
    </div>
  );
}
