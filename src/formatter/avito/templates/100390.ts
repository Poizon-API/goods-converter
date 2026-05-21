import { type AvitoCategorySchema } from "../shared";
import { buildSneakersSchema } from "./sneakersCommon";

/** Avito autoload template 100390 — «Балетки» (женская обувь). */
export const SCHEMA: AvitoCategorySchema = buildSneakersSchema({
  templateId: 100390,
  nodeName: "Балетки",
  goodsTypeValues: ["Женская обувь"],
  apparelTypeValues: ["Балетки"],
});
