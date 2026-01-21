import * as React from 'react';

interface Column {
  key: string;
  label: string;
  render?: (value: any, row: any) => React.ReactNode;
}

interface MobileTableProps {
  columns: Column[];
  data: any[];
  keyExtractor: (item: any) => string;
  onRowClick?: (item: any) => void;
}

const MobileTable: React.FC<MobileTableProps> = ({ columns, data, keyExtractor, onRowClick }) => {
  return (
    <>
      {/* Desktop Table View */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-sm text-left text-gray-600 dark:text-gray-300">
          <thead className="text-xs text-gray-500 dark:text-gray-400 uppercase bg-transparent">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  className="px-6 py-3 border-b border-gray-200 dark:border-gray-700"
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr
                key={keyExtractor(row)}
                onClick={() => onRowClick?.(row)}
                className={`border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors ${
                  onRowClick ? 'cursor-pointer' : ''
                }`}
              >
                {columns.map((column) => (
                  <td key={column.key} className="px-6 py-4">
                    {column.render ? column.render(row[column.key], row) : row[column.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View */}
      <div className="sm:hidden space-y-3">
        {data.map((row) => (
          <div
            key={keyExtractor(row)}
            onClick={() => onRowClick?.(row)}
            className={`glass-card p-4 rounded-lg ${
              onRowClick ? 'cursor-pointer touch-feedback' : ''
            }`}
          >
            {columns.map((column) => (
              <div key={column.key} className="flex justify-between items-start py-2 border-b border-gray-200 dark:border-gray-700 last:border-b-0">
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase">
                  {column.label}
                </span>
                <span className="text-sm text-gray-900 dark:text-gray-100 text-right ml-4 flex-1">
                  {column.render ? column.render(row[column.key], row) : row[column.key]}
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </>
  );
};

export default MobileTable;
