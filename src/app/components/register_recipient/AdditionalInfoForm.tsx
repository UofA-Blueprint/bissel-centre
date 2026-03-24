import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import CustomListbox from "./CustomListbox";

export type AdditionalInfoData = {
  journey: string;
  mostCommonReason: string;
  secondMostCommonReason: string;
  housingOption: string;
  arcCardDigits?: string;
  notes?: string;
};
type Props = {
  onSubmit: (data: AdditionalInfoData) => void;
  onError?: (msg: string | null) => void;
  initialData?: Partial<AdditionalInfoData>;
};

type ArcCardSearchResponse = {
  cards: string[];
};

const journeyOptions = [
  "Not yet ready to apply for Ride Transit/LAP programs due to housing situation",
  "Waiting/working with agency for documentation needed to apply for Ride Transit/LAP programs",
  "This agency emailed in their application for Ride Transit/LAP programs, waiting on approval",
  "Applied for the Ride Transit/LAP programs via Conditional Pass option at Edmonton Service Centre (ESC)",
  "Unattributed PATH Pass",
];
const reasonOptions = [
  "Financial/Support Appointments (Government, Agencies, Bank)",
  "Housing Appointments (Agencies, Viewing, Paperwork)",
  "Health and Wellness (Medical Appointments, Physical Health, i.e. Physio/Specialists)",
  "Food Security (Shopping, Food bank, Soup kitchen)",
  "Legal  (Court/Lawyer Appointments, Probation )",
  "Employment (Attendance and Seeking)",
  "Connection (Visiting friends and Family)",
  "Education (Attendance and Seeking)",
  "Recreation (Attending Events, Finding Activities)",
  "Safety (Weather Related, After Dark Safety)",
  "Volunteering",
];
const housingOptions = [
  "Unsheltered (Sleeping outdoors in a temporary home, i.e. tent, doorway etc.)",
  "Emergency Sheltered (Stayed at one of the overnight shelters)",
  "Provisionally Accommodated (limited time program i.e. treatment or hospitalization)",
  "Precariously Accommodated (high chance of eviction due to unstable income/behaviour, past due rent, utility cut off, couch surfing, no contract or lease)",
  "Transitioned to housing (up to 3 months post move-in)",
];

const AdditionalInfoForm = forwardRef<{ submit: () => void }, Props>(
  ({ onSubmit, onError, initialData = {} }, ref) => {
    const [journey, setJourney] = useState(initialData.journey ?? "");
    const [mostCommonReason, setMostCommonReason] = useState(
      initialData.mostCommonReason ?? "",
    );
    const [secondMostCommonReason, setSecondMostCommonReason] = useState(
      initialData.secondMostCommonReason ?? "",
    );
    const [housingOption, setHousingOption] = useState(
      initialData.housingOption ?? "",
    );
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
    const [notes, setNotes] = useState(initialData.notes ?? "");
    const latestSearchRequest = useRef(0);

    const normalizedArcCard = useMemo(
      () => arcCardDigits.replace(/\D/g, ""),
      [arcCardDigits],
    );

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
            {
              method: "GET",
              signal: abortController.signal,
            },
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
          if (abortController.signal.aborted) {
            return;
          }

          console.error("ARC card search failed:", error);
          setArcCardSuggestions([]);
          setArcCardLookupError(
            "Unable to load ARC card suggestions right now.",
          );
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

    const collect = (): AdditionalInfoData => ({
      journey,
      mostCommonReason,
      secondMostCommonReason,
      housingOption,
      arcCardDigits: arcCardDigits.trim(),
      notes: notes.trim(),
    });

    const validate = (data: AdditionalInfoData): string | null => {
      if (
        !data.journey ||
        !data.mostCommonReason ||
        !data.secondMostCommonReason ||
        !data.housingOption
      ) {
        return "Please fill out all required fields.";
      }

      if (data.arcCardDigits && !isArcCardConfirmed) {
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

    // Expose the submit method to parent components
    useImperativeHandle(ref, () => ({
      submit: handleSubmit,
      getData: collect,
      validate: () => validate(collect()),
    }));

    return (
      <form
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          handleSubmit();
        }}
      >
        <h1 className="text-lg font-medium text-gray-600">
          Please enter some additional information
        </h1>

        <div className="space-y-6">
          <CustomListbox
            label="Where is this community member in their journey to sustainable and affordable transit?"
            value={journey}
            onChange={setJourney}
            options={journeyOptions}
            required
          />

          <CustomListbox
            label="Please indicate the MOST COMMON reason the recipient used a bus pass last month"
            value={mostCommonReason}
            onChange={setMostCommonReason}
            options={reasonOptions}
            required
          />

          <CustomListbox
            label="Please indicate the SECOND MOST COMMON reason the recipient used a bus pass last month"
            value={secondMostCommonReason}
            onChange={setSecondMostCommonReason}
            options={reasonOptions}
            required
          />

          <CustomListbox
            label="Please indicate the MOST COMMON housing option the recipient used last month"
            value={housingOption}
            onChange={setHousingOption}
            options={housingOptions}
            required
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
            <label className="flex flex-col relative">
              <span className="text-sm mb-1">ARC Card Number</span>
              <input
                value={arcCardDigits}
                onChange={(e) => {
                  const digitsOnlyValue = e.target.value.replace(/\D/g, "");
                  setArcCardDigits(digitsOnlyValue);
                  setIsArcCardConfirmed(false);
                  setShowArcCardSuggestions(true);
                  setHasArcCardSearchCompleted(false);
                  if (arcCardLookupError) {
                    setArcCardLookupError(null);
                  }
                }}
                onFocus={() => setShowArcCardSuggestions(true)}
                onBlur={() => {
                  window.setTimeout(() => {
                    setShowArcCardSuggestions(false);
                  }, 100);
                }}
                type="text"
                name="arcCardDigits"
                inputMode="numeric"
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
                <span className="mt-1 text-xs text-red-600">
                  {arcCardLookupError}
                </span>
              )}
              {showArcCardSuggestions &&
                normalizedArcCard.length >= 3 &&
                !isSearchingArcCards &&
                !arcCardLookupError && (
                  <div className="absolute z-20 mt-[78px] w-full rounded-lg border bg-white shadow-lg max-h-52 overflow-y-auto">
                    {arcCardSuggestions.length === 0 &&
                    hasArcCardSearchCompleted ? (
                      <div className="px-3 py-2 text-sm text-gray-500">
                        No matching ARC cards found.
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
            <label className="flex flex-col">
              <span className="text-sm mb-1">Other/Notes</span>
              <input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                type="text"
                name="notes"
                placeholder="Enter any additional notes here"
                className="mt-1 text-sm font-normal border rounded-lg px-3 py-3 focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </label>
          </div>
        </div>
      </form>
    );
  },
);

AdditionalInfoForm.displayName = "AdditionalInfoForm";

export default AdditionalInfoForm;
