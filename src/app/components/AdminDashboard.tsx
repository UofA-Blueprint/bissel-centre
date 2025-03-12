import React from "react";
import Image from "next/image";

interface StatCardProps {
    icon: string;
    number: number;
    label: string;
}

const AdminDashboard = () => {
    return (
        <div className="p-6 bg-gray-100 min-h-screen">
            {/* Stats Section */}
            <div className="grid grid-cols-4 gap-4 mb-6">
                <StatCard
                    icon="/icons/creditCard.svg"
                    number={96}
                    label="Available Cards"
                />
                <StatCard
                    icon="/icons/check-mark.svg"
                    number={310}
                    label="Active Cards"
                />
                <StatCard
                    icon="/icons/alert-triangle.svg"
                    number={157}
                    label="Expired Cards"
                />
                <StatCard
                    icon="/icons/flag.svg"
                    number={23}
                    label="Flagged Users"
                />
            </div>

            {/* Search Bar */}
            <div className="flex items-center bg-white rounded-lg shadow-md p-4 mb-6">
                <input
                    type="text"
                    placeholder="Search recipients..."
                    className="flex-1 outline-none text-gray-700 px-2"
                />
                <button className="p-2 text-blue-500">
                    <Image
                        src="/icons/searchEnter.svg"
                        alt="Search"
                        width={20}
                        height={20}
                    />
                </button>
            </div>

            {/* Buttons Section */}
            <div className="flex justify-between mb-6">
                <button className="bg-gray-600 text-white px-4 py-2 rounded-md flex items-center">
                    + New Recipient
                </button>
                <button className="flex items-center text-gray-600 px-4 py-2">
                    <Image
                        src="/icons/filter.svg"
                        alt="Filter"
                        width={20}
                        height={20}
                        className="mr-2"
                    />{" "}
                    Filters
                </button>
            </div>

            {/* Placeholder for Illustration */}
            <div className="flex justify-center items-center bg-white p-10 rounded-lg shadow-md">
                <Image
                    src="/icons/blankSearchPlaceholder.svg"
                    alt="Illustration"
                    width={160}
                    height={160}
                />
            </div>
        </div>
    );
};

const StatCard: React.FC<StatCardProps> = ({ icon, number, label }) => {
    return (
        <div className="bg-white rounded-lg shadow-md p-4 flex flex-col items-center">
            <Image
                src={icon}
                alt={label}
                width={32}
                height={32}
                className="mb-2"
            />
            <h2 className="text-xl font-bold">{number}</h2>
            <p className="text-gray-500 text-sm">{label}</p>
        </div>
    );
};

export default AdminDashboard;
