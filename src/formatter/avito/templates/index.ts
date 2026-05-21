import { type AvitoCategorySchema } from "../shared";
import { type SupportedTemplateId } from "../types";
import { SCHEMA as SCHEMA_100368 } from "./100368";
import { SCHEMA as SCHEMA_100369 } from "./100369";
import { SCHEMA as SCHEMA_100370 } from "./100370";
import { SCHEMA as SCHEMA_100371 } from "./100371";
import { SCHEMA as SCHEMA_100372 } from "./100372";
import { SCHEMA as SCHEMA_100373 } from "./100373";
import { SCHEMA as SCHEMA_100374 } from "./100374";
import { SCHEMA as SCHEMA_100375 } from "./100375";
import { SCHEMA as SCHEMA_100376 } from "./100376";
import { SCHEMA as SCHEMA_100377 } from "./100377";
import { SCHEMA as SCHEMA_100378 } from "./100378";
import { SCHEMA as SCHEMA_100379 } from "./100379";
import { SCHEMA as SCHEMA_100380 } from "./100380";
import { SCHEMA as SCHEMA_100381 } from "./100381";
import { SCHEMA as SCHEMA_100383 } from "./100383";
import { SCHEMA as SCHEMA_100384 } from "./100384";
import { SCHEMA as SCHEMA_100385 } from "./100385";
import { SCHEMA as SCHEMA_100386 } from "./100386";
import { SCHEMA as SCHEMA_100387 } from "./100387";
import { SCHEMA as SCHEMA_100388 } from "./100388";
import { SCHEMA as SCHEMA_100389 } from "./100389";
import { SCHEMA as SCHEMA_100390 } from "./100390";
import { SCHEMA as SCHEMA_100391 } from "./100391";
import { SCHEMA as SCHEMA_100392 } from "./100392";
import { SCHEMA as SCHEMA_100393 } from "./100393";
import { SCHEMA as SCHEMA_100394 } from "./100394";
import { SCHEMA as SCHEMA_100395 } from "./100395";
import { SCHEMA as SCHEMA_100396 } from "./100396";
import { SCHEMA as SCHEMA_100397 } from "./100397";
import { SCHEMA as SCHEMA_100398 } from "./100398";
import { SCHEMA as SCHEMA_100399 } from "./100399";

/**
 * Реестр всех поддерживаемых Avito autoload-template'ов. Используется
 * `AvitoFormatter` для lookup'а схемы по `options.templateId`.
 *
 * При добавлении нового template'а:
 *   1. Положи `<id>.ts` рядом с этим файлом.
 *   2. Добавь сюда.
 *   3. Расширь `SupportedTemplateId` в `../types.ts`.
 */
export const TEMPLATE_REGISTRY: Record<
  SupportedTemplateId,
  AvitoCategorySchema
> = {
  100368: SCHEMA_100368,
  100369: SCHEMA_100369,
  100370: SCHEMA_100370,
  100371: SCHEMA_100371,
  100372: SCHEMA_100372,
  100373: SCHEMA_100373,
  100374: SCHEMA_100374,
  100375: SCHEMA_100375,
  100376: SCHEMA_100376,
  100377: SCHEMA_100377,
  100378: SCHEMA_100378,
  100379: SCHEMA_100379,
  100380: SCHEMA_100380,
  100381: SCHEMA_100381,
  100383: SCHEMA_100383,
  100384: SCHEMA_100384,
  100385: SCHEMA_100385,
  100386: SCHEMA_100386,
  100387: SCHEMA_100387,
  100388: SCHEMA_100388,
  100389: SCHEMA_100389,
  100390: SCHEMA_100390,
  100391: SCHEMA_100391,
  100392: SCHEMA_100392,
  100393: SCHEMA_100393,
  100394: SCHEMA_100394,
  100395: SCHEMA_100395,
  100396: SCHEMA_100396,
  100397: SCHEMA_100397,
  100398: SCHEMA_100398,
  100399: SCHEMA_100399,
};
