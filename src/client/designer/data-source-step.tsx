"use client";

// DataSourceStep — seção "Dados" do designer: lista os `fields` da fonte de dados JÁ
// SELECIONADA (o `CmSelect` que escolhe a fonte fica no cabeçalho do form, em
// `cm-report-designer.tsx`, junto de nome/slug — ver o comentário lá para o porquê dessa divisão)
// como chips compactos: nome do campo à esquerda; à direita, um botão de ícone "+" para adicionar
// como coluna, que vira um check + "Coluna já adicionada" quando a `key` já está no rascunho.
import type { ReactElement } from "react";
import { CmButton, CmEmpty } from "cosmemilton-ui/client";
import { CmIcon } from "cosmemilton-ui/server";
import type {
  ReportDataSource,
  ReportDataSourceField,
  SerializableReportColumn,
} from "../../core/types.js";
import type { CmReportDesignerLabels } from "./labels.js";

export type DataSourceStepProps = {
  /** Fonte de dados selecionada, já resolvida pelo pai a partir de `draft.dataSource`;
   *  `undefined` quando nenhuma fonte foi escolhida ainda. */
  dataSource: ReportDataSource | undefined;
  /** Colunas atuais do rascunho — usadas só para saber quais `key`s já foram adicionadas. */
  columns: SerializableReportColumn[];
  onAddColumn: (field: ReportDataSourceField) => void;
  disabled?: boolean;
  labels: CmReportDesignerLabels;
};

export function DataSourceStep(props: DataSourceStepProps): ReactElement {
  const { dataSource, columns, onAddColumn, disabled, labels } = props;

  if (!dataSource) {
    return (
      <CmEmpty
        title={labels.selectDataSourceEmptyTitle}
        description={labels.selectDataSourceEmptyDescription}
        className="cm-report-designer__source-empty"
      />
    );
  }

  const existingKeys = new Set(columns.map((column) => column.key));

  return (
    <div className="cm-report-designer__source-fields">
      {dataSource.fields.map((field) => {
        const alreadyAdded = existingKeys.has(field.key);
        return (
          <div key={field.key} className="cm-report-designer__source-field">
            <span className="cm-report-designer__source-field-label">{field.label}</span>
            {alreadyAdded ? (
              <span className="cm-report-designer__source-field-added">
                <CmIcon name="lucide:check" size={14} /> {labels.columnAlreadyAdded}
              </span>
            ) : (
              <CmButton
                type="button"
                variant="outline"
                size="sm"
                iconOnly
                icon={<CmIcon name="lucide:plus" size={16} />}
                aria-label={`${labels.addAsColumnButton}: ${field.label}`}
                title={labels.addAsColumnButton}
                onClick={() => onAddColumn(field)}
                disabled={disabled}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
