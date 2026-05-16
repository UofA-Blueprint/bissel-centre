// Reusable Listbox component to keep the main form clean
import {
  Listbox,
  ListboxButton,
  ListboxOptions,
  ListboxOption,
} from "@headlessui/react";
import ChevronDownIcon from "../icons/ChevronDownIcon";
import CheckIcon from "../icons/CheckIcon";
import clsx from "clsx";

type CustomListboxProps = {
  label: string;
  value?: string;
  onChange: (value: string) => void;
  options: string[];
  required?: boolean;
};

const CustomListbox = ({
  label,
  value,
  onChange,
  options,
  required = false,
}: CustomListboxProps) => (
  <label className="flex flex-col">
    <span className="text-sm mb-1">
      {label} {required && <span className="text-red-500">*</span>}
    </span>
    <Listbox value={value} onChange={onChange}>
      <div className="relative">
        <ListboxButton
          className="relative font-normal block w-full rounded-lg bg-white py-3 pr-8 pl-3 text-left text-sm text-gray-900 border focus:outline-none focus:ring-2 focus:ring-primary"
          aria-required={required}
          aria-invalid={required && !value}
        >
          <span className={clsx("block truncate", !value && "text-gray-400")}>
            {value || "Select an Option"}
          </span>
          <ChevronDownIcon
            className="pointer-events-none absolute top-3.5 right-2.5 h-4 w-4 text-gray-600"
            aria-hidden="true"
          />
        </ListboxButton>
        <ListboxOptions
          anchor="bottom"
          className="z-50 mt-1 max-h-60 w-[var(--button-width)] overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black/5 focus:outline-none sm:text-sm"
        >
          {options.map((opt) => (
            <ListboxOption
              key={opt}
              value={opt}
              className="font-normal flex items-center gap-2 rounded-md px-3 py-1.5 select-none data-[focus]:bg-gray-100"
            >
              {({ selected }) => (
                <>
                  <CheckIcon
                    className={clsx(
                      "h-4 w-4 text-primary",
                      !selected && "invisible",
                    )}
                  />
                  <div className={clsx("text-sm", selected && "font-semibold")}>
                    {opt}
                  </div>
                </>
              )}
            </ListboxOption>
          ))}
        </ListboxOptions>
      </div>
    </Listbox>
  </label>
);

export default CustomListbox;
