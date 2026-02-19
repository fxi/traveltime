import { TabulatorFull as Tabulator } from 'tabulator-tables';
import 'tabulator-tables/dist/css/tabulator_simple.min.css';

/**
 * Initializes a Tabulator table for the travel scenario model.
 * onChange(updatedModel) is called whenever the user edits a cell.
 */
export function initModelTable(containerId, model, onChange) {
  const table = new Tabulator(`#${containerId}`, {
    data: model,
    layout: 'fitColumns',
    cellEdited: () => onChange(table.getData()),
    columns: [
      { title: 'Class', field: 'class',     hozAlign: 'right', widthGrow: 1 },
      { title: 'Name',  field: 'name',      editor: 'input',   widthGrow: 1 },
      { title: 'Speed', field: 'speed',     editor: 'number',  hozAlign: 'right', widthGrow: 1,
        editorParams: { min: 0, max: 200, step: 0.5 } },
      { title: 'Mode',  field: 'mode',      editor: 'number',  hozAlign: 'right', widthGrow: 1 },
      { title: 'Color', field: 'color_hex', formatter: 'color', editor: 'input',  widthGrow: 1 },
    ],
  });
  return table;
}
