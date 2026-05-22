import { type AvitoCategorySchema } from "../shared";
import { buildSneakersSchema } from "./sneakersCommon";

/**
 * Avito autoload template 100388 — «Кроссовки и кеды» (женская обувь).
 *
 * Per-template поля (templateId, nodeName, goodsTypeValues, apparelTypeValues)
 * задаются здесь; остальные enum'ы и текстовые лимиты — общие для всех
 * sneakers-template'ов, см. `./sneakersCommon`. Sync с snapshot'ом проверяет
 * `test/avitoSchemaSync.spec.ts`.
 */
export const SCHEMA: AvitoCategorySchema = buildSneakersSchema({
  templateId: 100388,
  nodeName: "Кроссовки и кеды",
  goodsTypeValues: ["Женская обувь"],
  apparelTypeValues: ["Кроссовки и кеды"],
  // Снято с avito.ru/web/1/autoload/user-docs/category/100388/field/115538/values-xml
  // (женская обувь, 34..44+, шаг 0.5).
  sizeValues: [
    "34",
    "34,5",
    "35",
    "35,5",
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
    "44+",
  ],
});
