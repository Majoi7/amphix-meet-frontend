import { FC } from "react";

export const Header: FC = () => {
  return (
    <header className="flex items-center justify-between p-4 bg-white border-b border-gray-200">
      <h1 className="text-xl font-semibold text-gray-800">Amphix Admin</h1>
      <div className="flex items-center space-x-4">
        <span className="text-gray-600">Welcome</span>
      </div>
    </header>
  );
};