"use client";

// DataSourceStep — seção "Dados" do designer: lista os `fields` da fonte de dados JÁ
// SELECIONADA (o `CmSelect` que escolhe a fonte fica no cabeçalho do form, em
// `cm-report-designer.tsx`, junto de nome/slug — ver o comentário lá para o porquê dessa divisão)
// com um botão "Adicionar como coluna" por campo. O botão fica desabilitado quando a `key` do
// campo já é uma coluna do rascunho — mas mantém o rótulo "Adicionar como coluna" sempre (o aviso
// "Coluna já adicionada" aparece como texto auxiliar ao lado, não substitui o rótulo do botão).
import type { ReactElement } from "react";
import { CmButton, CmEmpty } from "cosmemilton-ui/client";
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
                {labels.columnAlreadyAdded}
              </span>
            ) : null}
            <CmButton
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onAddColumn(field)}
              disabled={disabled || alreadyAdded}
            >
              {labels.addAsColumnButton}
            </CmButton>
          </div>
        );
      })}
    </div>
  );
}
