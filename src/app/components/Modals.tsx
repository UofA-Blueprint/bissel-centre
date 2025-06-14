import React, { useState } from "react";
import { X } from "lucide-react";

interface BanModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string, notes: string) => void;
  isBanning: boolean; // true for ban, false for unban
  userName: string;
}

export function BanModal({
  isOpen,
  onClose,
  onConfirm,
  isBanning,
  userName,
}: BanModalProps) {
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isBanning && (!reason.trim() || !notes.trim())) return;
    onConfirm(reason, notes);
    setReason("");
    setNotes("");
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">
            {isBanning ? "Flag User" : "Remove Flag"}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <p className="text-gray-600 mb-4">
            {isBanning
              ? `Are you sure you want to flag ${userName}?`
              : `Are you sure you want to remove the flag from ${userName}?`}
          </p>

          {isBanning && (
            <>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Reason for flagging *
                </label>
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Enter reason..."
                  required
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notes *
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  rows={3}
                  placeholder="Additional notes..."
                  required
                />
              </div>
            </>
          )}

          <div className="flex space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className={`flex-1 px-4 py-2 rounded-md text-white ${
                isBanning
                  ? "bg-red-600 hover:bg-red-700"
                  : "bg-green-600 hover:bg-green-700"
              }`}
            >
              {isBanning ? "Flag User" : "Remove Flag"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface OverrideModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  action: string; // 'issue' or 'renew'
  banReason: string;
}

export function OverrideModal({
  isOpen,
  onClose,
  onConfirm,
  action,
  banReason,
}: OverrideModalProps) {
  const [reason, setReason] = useState("");

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) return;
    onConfirm(reason);
    setReason("");
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-red-600">
            User is Flagged
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X size={20} />
          </button>
        </div>

        <div className="mb-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
            <p className="text-red-800 font-medium">⚠️ This user is flagged</p>
            <p className="text-red-600 text-sm mt-1">Reason: {banReason}</p>
          </div>

          <p className="text-gray-600 mb-4">
            This user is currently flagged and not allowed to {action} an ARC
            card. You can override this restriction by providing a reason.
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Override Reason *
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              rows={3}
              placeholder="Explain why you're overriding the flag..."
              required
            />
          </div>

          <div className="flex space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-md"
            >
              Override & {action === "issue" ? "Issue" : "Renew"} Card
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface AccountStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (status: "Active" | "Inactive") => void;
  userName: string;
  currentStatus: "Active" | "Inactive";
}

export function AccountStatusModal({
  isOpen,
  onClose,
  onConfirm,
  userName,
  currentStatus,
}: AccountStatusModalProps) {
  const [selectedStatus, setSelectedStatus] = useState<"Active" | "Inactive">(
    currentStatus
  );

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirm(selectedStatus);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Account Status</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <p className="text-gray-600 mb-4">
              Set the account status for {userName}:
            </p>

            <div className="space-y-3">
              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="radio"
                  name="status"
                  value="Active"
                  checked={selectedStatus === "Active"}
                  onChange={(e) =>
                    setSelectedStatus(e.target.value as "Active" | "Inactive")
                  }
                  className="text-green-600 focus:ring-green-500"
                />
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
                  <span className="text-gray-700 font-medium">Active</span>
                </div>
                <span className="text-sm text-gray-500">
                  - Account is active and can receive services
                </span>
              </label>

              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="radio"
                  name="status"
                  value="Inactive"
                  checked={selectedStatus === "Inactive"}
                  onChange={(e) =>
                    setSelectedStatus(e.target.value as "Active" | "Inactive")
                  }
                  className="text-gray-600 focus:ring-gray-500"
                />
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-gray-400 rounded-full mr-2"></div>
                  <span className="text-gray-700 font-medium">Inactive</span>
                </div>
                <span className="text-sm text-gray-500">
                  - Account is inactive but not banned
                </span>
              </label>
            </div>

            {currentStatus !== selectedStatus && (
              <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-blue-800 text-sm">
                  <strong>Note:</strong> Changing the status from{" "}
                  {currentStatus} to {selectedStatus} will be recorded in the
                  account history.
                </p>
              </div>
            )}
          </div>

          <div className="flex space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-primary hover:bg-primary/80 text-white rounded-md"
            >
              Update Status
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface DeleteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  userName: string;
}

export function DeleteModal({
  isOpen,
  onClose,
  onConfirm,
  userName,
}: DeleteModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-red-600">Delete Account</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X size={20} />
          </button>
        </div>

        <div className="mb-6">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
            <p className="text-red-800 font-medium">
              ⚠️ This action cannot be undone
            </p>
          </div>

          <p className="text-gray-600">
            Are you sure you want to permanently delete {userName}'s account?
            This will remove all associated data including ARC cards, history,
            and personal information.
          </p>
        </div>

        <div className="flex space-x-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md"
          >
            Delete Account
          </button>
        </div>
      </div>
    </div>
  );
}
