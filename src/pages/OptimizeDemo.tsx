import * as React from "react";
import FlatTopology, { TopologyData } from "../components/FlatTopology";

const data: TopologyData = {
  hypers: [
    { id:"aws-usw2",   name:"AWS us-west-2", kind:"aws" },
    { id:"azure-west", name:"Azure West US 2", kind:"azure" },
    { id:"gcp-central",name:"GCP us-central1", kind:"gcp" },
    { id:"sap-prod",   name:"SAP ERP", kind:"app" },
  ],
  pops: [
    { id:"meg-sfo1", name:"Megaport SFO1", lat:37.7749, lon:-122.4194, facility:"Equinix SV" },
    { id:"meg-lax1", name:"Megaport LAX1", lat:34.0522, lon:-118.2437, facility:"Digital Realty" },
    { id:"meg-dfw1", name:"Megaport DFW1", lat:32.7767, lon:-96.7970,  facility:"CoreSite" },
  ],
  sites: [
    { id:"site-sf",  name:"SF Office",   lat:37.78, lon:-122.41, city:"San Francisco", state:"CA" },
    { id:"site-oak", name:"Oakland DC",  lat:37.80, lon:-122.27, city:"Oakland",       state:"CA" },
    { id:"site-la",  name:"LA Branch",   lat:34.05, lon:-118.24, city:"Los Angeles",   state:"CA" },
    { id:"site-irv", name:"Irvine Hub",  lat:33.68, lon:-117.82, city:"Irvine",        state:"CA" },
    { id:"site-dal", name:"Dallas WH",   lat:32.78, lon:-96.80,  city:"Dallas",        state:"TX" },
  ],
};

export default function OptimizeDemo() {
  return (
    <div className="p-6">
      <FlatTopology data={data}/>
    </div>
  );
}
