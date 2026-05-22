import { type AvitoCategorySchema } from "../shared";
import { buildSneakersSchema } from "./sneakersCommon";

/**
 * Avito autoload template 100368 — «Кроссовки» (мужская обувь).
 *
 * Per-template поля (templateId, nodeName, goodsTypeValues, apparelTypeValues)
 * задаются здесь; остальные enum'ы и текстовые лимиты — общие для всех
 * sneakers-template'ов, см. `./sneakersCommon`. Sync с snapshot'ом проверяет
 * `test/avitoSchemaSync.spec.ts`.
 */
export const SCHEMA: AvitoCategorySchema = buildSneakersSchema({
  templateId: 100368,
  nodeName: "Кроссовки",
  goodsTypeValues: ["Мужская обувь"],
  apparelTypeValues: ["Кроссовки"],
  // Снято с avito.ru/web/1/autoload/user-docs/category/100368/field/115164/values-xml
  // (мужская обувь, 36..48+, шаг 0.5; запятая — десятичный разделитель Avito).
  sizeValues: [
    "36",
    "36,5",
    "37",
    "37,5",
    "38",
    "38,5",
    "39",
    "39,5",
    "40",
    "40,5",
    "41",
    "41,5",
    "42",
    "42,5",
    "43",
    "43,5",
    "44",
    "44,5",
    "45",
    "45,5",
    "46",
    "46,5",
    "47",
    "47,5",
    "48+",
  ],
});
