import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { FileSpreadsheet, FileText } from "lucide-react-native";
import { useState } from "react";
import { Pressable, View } from "react-native";

import { Text } from "@/components/ui/Text";
import { toast } from "@/components/ui/Toast";
import { useI18n } from "@/i18n/I18nProvider";
import { downloadReport, REPORT_TYPES, reportFileName, type ReportFormat } from "@/services/reports";
import { useColors } from "@/theme/ThemeProvider";

/** PDF and Excel files of a month and of its whole year (feature F5): saved, then shared
 *  through the phone's share sheet (Files, Drive, WhatsApp, mail...). */
export function DownloadReport({ month }: { month: string }) {
  const { t, monthLabel } = useI18n();
  const colors = useColors();
  const [busy, setBusy] = useState<string | null>(null);
  const year = month.slice(0, 4);

  async function get(period: string, format: ReportFormat) {
    setBusy(`${period}-${format}`);
    try {
      const data = await downloadReport(period, format);
      const file = new File(Paths.cache, reportFileName(period, format));
      file.create({ overwrite: true });
      file.write(new Uint8Array(data));
      await Sharing.shareAsync(file.uri, { mimeType: REPORT_TYPES[format], dialogTitle: reportFileName(period, format) });
    } catch {
      toast.error(t.reports.failed);
    } finally {
      setBusy(null);
    }
  }

  const row = (label: string, period: string, first: boolean) => (
    <View key={period} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, paddingVertical: 12, borderTopWidth: first ? 0 : 1, borderColor: colors.line }}>
      <Text weight="semibold" style={{ flex: 1 }}>{label}</Text>
      <View style={{ flexDirection: "row", gap: 8 }}>
        {(["pdf", "xlsx"] as const).map((format) => {
          const Icon = format === "pdf" ? FileText : FileSpreadsheet;
          return (
            <Pressable
              key={format}
              disabled={busy !== null}
              onPress={() => void get(period, format)}
              accessibilityRole="button"
              style={({ pressed }) => ({
                flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 12, borderWidth: 1, borderColor: colors.line,
                paddingHorizontal: 12, paddingVertical: 7, opacity: busy !== null ? 0.5 : 1,
                backgroundColor: pressed ? `${colors.ink}0d` : "transparent",
              })}>
              <Icon size={16} color={colors.ink} />
              <Text size={14} weight="semibold">{busy === `${period}-${format}` ? "…" : format === "pdf" ? t.reports.pdf : t.reports.excel}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );

  return (
    <View style={{ borderRadius: 24, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, paddingHorizontal: 20, paddingVertical: 16 }}>
      <Text size={13} weight="semibold" tone="muted">{t.reports.title.toUpperCase()}</Text>
      <Text size={14} tone="muted" style={{ marginTop: 4, marginBottom: 4 }}>{t.reports.intro}</Text>
      {row(t.reports.thisMonth(monthLabel(month)), month, true)}
      {row(t.reports.wholeYear(year), year, false)}
    </View>
  );
}
