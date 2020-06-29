export interface User {
    id: number;
    name: String;
}
export interface Feeding {
    id: number;
    who?: number;       // user id
    time: number;       // unix epoch timestamp
}