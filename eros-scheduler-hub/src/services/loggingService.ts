import {CONFIG} from '../config';
import {BigQueryService} from './bigquery';

const {projectId, datasets, tables, timezone} = CONFIG;
const ops = `${projectId}.${datasets.ops}`;

const stringParam = (name: string, value: string): GoogleAppsScript.BigQuery.Schema.QueryParameter => ({
  name,
  parameterType: {type: 'STRING'},
  parameterValue: {value}
});

export interface ActionPayload {
  trackingHash: string;
  usernameStd: string;
  pageType: string;
  usernamePage: string;
  priceUsd: number;
  captionId: string | null;
  hodLocal: number;
  status: 'Ready' | 'Queued' | 'Sent';
}

export class LoggingService {
  private readonly bq = new BigQueryService();

  submitActions(payloads: ActionPayload[], schedulerEmail: string, schedulerCode: string): void {
    if (!payloads.length) {
      throw new Error('Please mark rows as Ready or Sent before submitting.');
    }
    const sql = `
      INSERT \`${ops}.${tables.sendLog}\`
        (action_ts, action_date, tracking_hash, username_std, page_type, username_page,
         scheduler_code, scheduler_email, date_local, hod_local, price_usd, caption_id,
         status, action, source)
      SELECT
        CURRENT_TIMESTAMP(),
        CURRENT_DATE(@tz),
        payload.tracking_hash,
        payload.username_std,
        payload.page_type,
        payload.username_page,
        @schedulerCode,
        @schedulerEmail,
        CURRENT_DATE(@tz),
        payload.hod_local,
        payload.price_usd,
        payload.caption_id,
        payload.status,
        'ui_submit',
        'sheets_hub_v2'
      FROM UNNEST(@payloads) AS payload
    `;

    const params: GoogleAppsScript.BigQuery.Schema.QueryParameter[] = [
      stringParam('schedulerEmail', schedulerEmail),
      stringParam('schedulerCode', schedulerCode),
      stringParam('tz', timezone),
      {
        name: 'payloads',
        parameterType: {
          type: 'ARRAY',
          arrayType: {
            type: 'STRUCT',
            structTypes: [
              {name: 'tracking_hash', type: {type: 'STRING'}},
              {name: 'username_std', type: {type: 'STRING'}},
              {name: 'page_type', type: {type: 'STRING'}},
              {name: 'username_page', type: {type: 'STRING'}},
              {name: 'hod_local', type: {type: 'INT64'}},
              {name: 'price_usd', type: {type: 'FLOAT64'}},
              {name: 'caption_id', type: {type: 'STRING'}},
              {name: 'status', type: {type: 'STRING'}}
            ]
          }
        },
        parameterValue: {
          arrayValues: payloads.map((p) => ({
            structValues: {
              tracking_hash: {value: p.trackingHash},
              username_std: {value: p.usernameStd},
              page_type: {value: p.pageType},
              username_page: {value: p.usernamePage},
              hod_local: {value: String(p.hodLocal)},
              price_usd: {value: p.priceUsd.toString()},
              caption_id: {value: p.captionId ?? ''},
              status: {value: p.status}
            }
          }))
        }
      }
    ];

    this.bq.insert(sql, params);
  }
}
