export type Area = 'NCR' | 'QUEZON_CITY' | string;
export interface Facility {id:string;name:string;city:string;latitude:number;longitude:number;authorizedBeds:number|null;source:string;verifiedAt:string|null;}
export interface FacilityResult {facilityId:string;week:number;availablePct:number|null;capacityGap:number|null;note:string;}
export interface ScenarioResult {scenarioId:string;area:string;weeks:number;parameters:{hospitalizationRate:number;lengthOfStayDays:number;baselineOccupancy:number;surgeMultiplier:number};facilityResults:FacilityResult[];disclaimer:string;}
