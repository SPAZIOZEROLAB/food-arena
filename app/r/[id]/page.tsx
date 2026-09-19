import Ticket from './ticket';
export default async function RequestPage({params}:{params:Promise<{id:string}>}){const {id}=await params;return <Ticket id={id}/>}
