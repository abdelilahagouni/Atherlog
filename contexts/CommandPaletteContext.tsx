import * as React from 'react';

interface CommandPaletteContextType {
  isOpen: boolean;
  openPalette: () => void;
  closePalette: () => void;
  togglePalette: () => void;
}

const CommandPaletteContext = React.createContext<CommandPaletteContextType | undefined>(undefined);

export const CommandPaletteProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isOpen, setIsOpen] = React.useState(false);

  const openPalette = () => setIsOpen(true);
  const closePalette = () => setIsOpen(false);
  const togglePalette = () => setIsOpen(prev => !prev);

  return (
    <CommandPaletteContext.Provider value={{ isOpen, openPalette, closePalette, togglePalette }}>
      {children}
    </CommandPaletteContext.Provider>
  );
};

export const useCommandPalette = (): CommandPaletteContextType => {
  const context = React.useContext(CommandPaletteContext);
  if (context === undefined) {
    throw new Error('useCommandPalette must be used within a CommandPaletteProvider');
  }
  return context;
};