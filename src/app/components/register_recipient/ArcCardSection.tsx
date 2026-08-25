"use client";

import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";

export type ArcCardSectionData = {
  arcCardDigits: string;
  currentCardId?: string;
  currentStatus?: string;
  currentDepartment?: string;
  allocationDate?: string;
};

type ArcCardSearchResponse = {
  cards: string[];
};

type Props = {
  onSubmit: (data: ArcCardSectionData) => void;
  onError?: (msg: string | null) => void;
  initialData?: Partial<ArcCardSectionData>;
};

const ArcCardSection = forwardRef<{ submit: () => void }, Props>(
  ({ onSubmit, onError, initialData = {} }, ref) => {
    const [arcCardDigits, setArcCardDigits] = useState(
      initialData.arcCardDigits ?? "",
    );
    const [arcCardSuggestions, setArcCardSuggestions] = useState<string[]>([]);
    const [isSearchingArcCards, setIsSearchingArcCards] = useState(false);
    const [hasArcCardSearchCompleted, setHasArcCardSearchCompleted] =
      useState(false);
    const [arcCardLookupError, setArcCardLookupError] = useState<string | null>(
      null,
    );
    const [showArcCardSuggestions, setShowArcCardSuggestions] = useState(false);
    const [isArcCardConfirmed, setIsArcCardConfirmed] = useState(
      Boolean((initialData.arcCardDigits ?? "").trim()),
    );
    const latestSearchRequest = useRef(0);

    const normalizedArcCard = useMemo(
      () => arcCardDigits.replace(/\D/g, ""),
      [arcCardDigits],
    );

    useEffect(() => {
      setArcCardDigits(initialData.arcCardDigits ?? "");
      setIsArcCardConfirmed(Boolean((initialData.arcCardDigits ?? "").trim()));
    }, [initialData.arcCardDigits]);

    useEffect(() => {
      if (normalizedArcCard.length < 3) {
        setArcCardSuggestions([]);
        setArcCardLookupError(null);
        setIsSearchingArcCards(false);
        setHasArcCardSearchCompleted(false);
        return;
      }

      const requestId = ++latestSearchRequest.current;
      const abortController = new AbortController();
      const timeoutId = window.setTimeout(async () => {
        setIsSearchingArcCards(true);
        setArcCardLookupError(null);
        setHasArcCardSearchCompleted(false);

        try {
          const response = await fetch(
            `/api/cards/search?query=${encodeURIComponent(normalizedArcCard)}`,
            { method: "GET", signal: abortController.signal },
          );
          if (!response.ok) {
            throw new Error("Failed to search ARC cards");
          }
          const data: ArcCardSearchResponse = await response.json();
          if (requestId !== latestSearchRequest.current) {
            return;
          }
          setArcCardSuggestions(data.cards ?? []);
        } catch (error) {
          if (abortController.signal.aborted) return;
          console.error("ARC card search failed:", error);
          setArcCardSuggestions([]);
          setArcCardLookupError("Unable to load ARC card suggestions right now.");
        } finally {
          if (requestId === latestSearchRequest.current) {
            setIsSearchingArcCards(false);
            setHasArcCardSearchCompleted(true);
          }
        }
      }, 250);

      return () => {
        abortController.abort();
        window.clearTimeout(timeoutId);
      };
    }, [normalizedArcCard]);

    const collect = (): ArcCardSectionData => ({
      arcCardDigits: arcCardDigits.trim(),
      currentCardId: initialData.currentCardId,
      currentStatus: initialData.currentStatus,
      currentDepartment: initialData.currentDepartment,
      allocationDate: initialData.allocationDate,
    });

    const validate = (data: ArcCardSectionData): string | null => {
      if (!data.arcCardDigits) {
        return null;
      }
      if (!isArcCardConfirmed) {
        return "Please select an ARC card from the search suggestions.";
      }
      return null;
    };

    const handleSubmit = () => {
      const data = collect();
      const error = validate(data);
      if (error) {
        onError?.(error);
        return;
      }
      onError?.(null);
      onSubmit(data);
    };

    useImperativeHandle(ref, () => ({
      submit: handleSubmit,
      getData: collect,
      validate: () => validate(collect()),
    }));

    return (
      <div className="space-y-5">
        <h1 className="text-lg font-medium text-gray-700">ARC Card</h1>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-sm text-gray-600">
            Current card:{" "}
            <span className="font-medium text-gray-800">
              {initialData.arcCardDigits || "No active card"}
            </span>
          </p>
          <p className="mt-1 text-sm text-gray-500">
            Department: {initialData.currentDepartment || "N/A"} • Status:{" "}
            {initialData.currentStatus || "N/A"} • Allocation Date:{" "}
            {initialData.allocationDate || "N/A"}
          </p>
        </div>
        <label className="flex flex-col relative">
          <span className="text-sm mb-1">
            Assign/Replace ARC Card (search unattributed cards)
          </span>
          <input
            value={arcCardDigits}
            onChange={(e) => {
              const digitsOnlyValue = e.target.value.replace(/\D/g, "");
              setArcCardDigits(digitsOnlyValue);
              setIsArcCardConfirmed(false);
              setShowArcCardSuggestions(true);
              setHasArcCardSearchCompleted(false);
              if (arcCardLookupError) setArcCardLookupError(null);
            }}
            onFocus={() => setShowArcCardSuggestions(true)}
            onBlur={() => {
              window.setTimeout(() => {
                setShowArcCardSuggestions(false);
              }, 100);
            }}
            type="text"
            name="arcEditCardId"
            id="arcEditCardId"
            inputMode="numeric"
            autoComplete="off"
            placeholder="Type at least 3 digits to search"
            className="mt-1 text-sm font-normal border rounded-lg px-3 py-3 focus:outline-none focus:ring-2 focus:ring-primary"
          />
          {normalizedArcCard.length > 0 && normalizedArcCard.length < 3 && (
            <span className="mt-1 text-xs text-gray-500">
              Enter at least 3 digits to see matching ARC cards.
            </span>
          )}
          {isSearchingArcCards && (
            <span className="mt-1 text-xs text-gray-500">
              Searching ARC cards...
            </span>
          )}
          {arcCardLookupError && (
            <span className="mt-1 text-xs text-red-600">{arcCardLookupError}</span>
          )}
          {showArcCardSuggestions &&
            normalizedArcCard.length >= 3 &&
            !isSearchingArcCards &&
            !arcCardLookupError && (
              <div className="absolute z-20 mt-[78px] w-full rounded-lg border bg-white shadow-lg max-h-52 overflow-y-auto">
                {arcCardSuggestions.length === 0 && hasArcCardSearchCompleted ? (
                  <div className="px-3 py-2 text-sm text-gray-500">
                    No matching unattributed ARC cards found.
                  </div>
                ) : (
                  arcCardSuggestions.map((cardNumber) => (
                    <button
                      key={cardNumber}
                      type="button"
                      className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setArcCardDigits(cardNumber);
                        setIsArcCardConfirmed(true);
                        setShowArcCardSuggestions(false);
                        setArcCardLookupError(null);
                      }}
                    >
                      {cardNumber}
                    </button>
                  ))
                )}
              </div>
            )}
        </label>
        <p className="text-xs text-gray-500">
          Leave this unchanged to keep the current card assignment as-is.
        </p>
      </div>
    );
  },
);

ArcCardSection.displayName = "ArcCardSection";

export default ArcCardSection;
