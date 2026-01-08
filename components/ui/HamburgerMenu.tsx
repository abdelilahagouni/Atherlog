import * as React from 'react';

interface HamburgerMenuProps {
  isOpen: boolean;
  onClick: () => void;
}

const HamburgerMenu: React.FC<HamburgerMenuProps> = ({ isOpen, onClick }) => {
  const genericHamburgerLine = `h-0.5 w-6 my-1 rounded-full bg-gray-600 dark:bg-gray-300 transition ease transform duration-300`;

  return (
    <button
      className="flex flex-col h-12 w-12 border-2 border-transparent rounded justify-center items-center group z-50"
      onClick={onClick}
      aria-label="Toggle menu"
    >
      <div
        className={`${genericHamburgerLine} ${
          isOpen
            ? "rotate-45 translate-y-2 group-hover:opacity-100"
            : "group-hover:opacity-100"
        }`}
      />
      <div
        className={`${genericHamburgerLine} ${
          isOpen ? "opacity-0" : "group-hover:opacity-100"
        }`}
      />
      <div
        className={`${genericHamburgerLine} ${
          isOpen
            ? "-rotate-45 -translate-y-2 group-hover:opacity-100"
            : "group-hover:opacity-100"
        }`}
      />
    </button>
  );
};

export default HamburgerMenu;