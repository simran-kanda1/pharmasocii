import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export type AdminDetailRow = {
  label: string;
  value: React.ReactNode;
};

export function AdminAttributeTable({ rows }: { rows: AdminDetailRow[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[200px] font-semibold">Attribute</TableHead>
          <TableHead className="font-semibold">Value</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.label}>
            <TableCell className="font-medium align-top">{row.label}</TableCell>
            <TableCell className="align-top">{row.value}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
