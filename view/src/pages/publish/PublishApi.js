import React, { useState } from "react";
import SpecDetail from "./SpecDetail";
import SpecUpload from "./SpecUpload";
import ConfigOption from "./ConfigOption";
import ConfigDetail from "./ConfigDetail";
import ConfigUpload from "./ConfigUpload";
import Summary from "./Summary";
import useStyles from "./styles";

export default function PublishApi(props) {
    var classes = useStyles();
    const [step, setStep] = useState(1);

    const specDetail = () => {
        setStep(1);
    }
  
    const specUpload = () => {
        setStep(2);
    }

    const configOption = () => {
        setStep(3);
    }
    
    const configDetail = () => {
        setStep(4);
    }

    const configUpload = () => {
        setStep(5);
    }

    const summary = () => {
        setStep(6);
    }
  
    return (
        <div>
            <SpecDetail {...props} step={step} classes={classes} specUpload={specUpload} />
            <SpecUpload {...props} step={step} />
            <ConfigOption {...props} step={step} />
            <ConfigDetail {...props} step={step} />
            <ConfigUpload {...props} step={step} />
            <Summary {...props} step={step} />
        </div>
    );
}
