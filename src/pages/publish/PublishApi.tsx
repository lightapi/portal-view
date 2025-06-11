import Button from '@mui/material/Button';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useDropzone } from 'react-dropzone';
import { SchemaForm, utils } from 'react-schema-form';
import { useSiteDispatch, useSiteState } from '../../contexts/SiteContext';
import forms from '../../data/Forms';
import useStyles from './styles';

var spec = null;
const baseStyle = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  padding: '20px',
  borderWidth: 2,
  borderRadius: 2,
  borderColor: '#eeeeee',
  borderStyle: 'dashed',
  backgroundColor: '#fafafa',
  color: '#bdbdbd',
  outline: 'none',
  transition: 'border .24s ease-in-out',
};

const activeStyle = {
  borderColor: '#2196f3',
};

const acceptStyle = {
  borderColor: '#00e676',
};

const rejectStyle = {
  borderColor: '#ff1744',
};

function Summary(props) {
  const { step, classes } = props;

  if (step !== 4) {
    return null;
  }

  return <div>Summary</div>;
}

function FileUpload(props) {
  const { step, classes } = props;
  const [files, setFiles] = useState();

  const onDrop = useCallback((acceptedFiles) => {
    let valid = false;
    acceptedFiles.map((file) => {
      if (acceptedFiles.length === 1 && file.name === 'openapi.yaml') {
        const fr = new FileReader();
        fr.readAsText(file);
      }
      return false;
    });
    setFiles(acceptedFiles);
  }, []);
  const {
    getRootProps,
    getInputProps,
    isDragActive,
    isDragAccept,
    isDragReject,
  } = useDropzone({ onDrop });

  const style = useMemo(
    () => ({
      ...baseStyle,
      ...(isDragActive ? activeStyle : {}),
      ...(isDragAccept ? acceptStyle : {}),
      ...(isDragReject ? rejectStyle : {}),
    }),
    [isDragActive, isDragReject, isDragAccept]
  );

  if (step !== 3) {
    return null;
  }

  return (
    <div className="container">
      <div {...getRootProps({ style })}>
        <input {...getInputProps()} />
        {isDragActive ? (
          <p>Drop the openapi.yaml here ...</p>
        ) : (
          <p>
            Drag 'n' drop the openapi.yaml here, or click to select the file
          </p>
        )}
      </div>
    </div>
  );
}

function ConfigDetail(props) {
  const { step, classes, fileUpload } = props;
  let params = new URLSearchParams(props.location.search);
  let style = params.get('style');
  const [model, setModel] = useState({ ...useSiteState().configDetail });
  const [updated, setUpdated] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [configDetail, setConfigDetail] = useState();
  let siteDispatch = useSiteDispatch();
  const mounted = useRef();
  useEffect(() => {
    if (!mounted.current) {
      // do componentDidMount logic
      mounted.current = true;
    } else {
      // do componentDidUpdate logic
      if (spec && !updated) {
        console.log('ConfigDetail is updated', spec);
        const domain =
          spec && spec.host ? spec.host.split('.').reverse().join('.') : '';
        let configDetail = {
          name: spec && spec.name ? spec.name.toLowerCase() : null,
          version: spec && spec.version ? spec.version : null,
          style: spec && spec.style ? spec.style : null,
          groupId: domain,
          artifactId: spec && spec.name ? spec.name.toLowerCase() : null,
          rootPackage: domain,
          handlerPackage: domain + '.handler',
          modelPackage: domain + '.model',
        };
        setModel(configDetail);
        setUpdated(true);
      }
    }
  });

  useEffect(() => {
    siteDispatch({ type: 'UPDATE_CONFIGDETAIL', configDetail: configDetail });
  }, [configDetail]);

  if (step !== 2) {
    return null;
  }

  let formData = forms['configDetailForm'];
  var buttons = [];

  const onModelChange = (key, val, type) => {
    utils.selectOrSet(key, model, val, type);
    setModel({ ...model }); // here we must create a new object to force re-render.
  };

  const onButtonClick = (item) => {
    console.log(item);
    let validationResult = utils.validateBySchema(formData.schema, model);
    console.log(validationResult);
    if (!validationResult.valid) {
      setShowErrors(true);
    } else {
      setConfigDetail(model);
      if (item.action === 'upload') {
        fileUpload();
      }
    }
  };

  formData.actions.map((item, index) => {
    buttons.push(
      <Button
        variant="contained"
        className={classes.button}
        color="primary"
        key={index}
        onClick={(e) => onButtonClick(item)}
      >
        {item.title}
      </Button>
    );
    return buttons;
  });

  let title = <h2>{formData.schema.title}</h2>;

  return (
    <div>
      {title}
      <SchemaForm
        schema={formData.schema}
        form={formData.form}
        model={model}
        showErrors={showErrors}
        onModelChange={onModelChange}
      />
      {buttons}
    </div>
  );
}

function SpecDetail(props) {
  const { step, classes, fileUpload, configDetail } = props;
  let params = new URLSearchParams(props.location.search);
  let style = params.get('style');
  const [model, setModel] = useState({ ...useSiteState().specDetail, style });
  const [showErrors, setShowErrors] = useState(false);
  const [specDetail, setSpecDetail] = useState();

  let siteDispatch = useSiteDispatch();

  useEffect(() => {
    siteDispatch({ type: 'UPDATE_SPECDETAIL', specDetail });
    spec = specDetail;
  }, [specDetail]);

  if (step !== 1) {
    return null;
  }

  let formData = forms['specDetailForm'];
  var buttons = [];

  const onModelChange = (key, val, type) => {
    utils.selectOrSet(key, model, val, type);
    setModel({ ...model }); // here we must create a new object to force re-render.
  };

  const onButtonClick = (item) => {
    console.log(item);
    let validationResult = utils.validateBySchema(formData.schema, model);
    console.log(validationResult);
    if (!validationResult.valid) {
      setShowErrors(true);
    } else {
      setSpecDetail(model);
      if (item.action === 'uploadFiles') {
        fileUpload();
      } else if (item.action === 'inputConfig') {
        configDetail();
      }
    }
  };

  formData.actions.map((item, index) => {
    buttons.push(
      <Button
        variant="contained"
        className={classes.button}
        color="primary"
        key={index}
        onClick={(e) => onButtonClick(item)}
      >
        {item.title}
      </Button>
    );
    return buttons;
  });

  let title = <h2>{formData.schema.title}</h2>;

  return (
    <div>
      {title}
      <SchemaForm
        schema={formData.schema}
        form={formData.form}
        model={model}
        mapper={mapper}
        showErrors={showErrors}
        onModelChange={onModelChange}
      />
      {buttons}
    </div>
  );
}

export default function PublishApi(props) {
  var classes = useStyles();
  const [step, setStep] = useState(1);

  const specDetail = () => {
    setStep(1);
  };

  const configDetail = () => {
    setStep(2);
  };

  const fileUpload = () => {
    setStep(3);
  };

  const summary = () => {
    setStep(4);
  };

  return (
    <div>
      <SpecDetail
        {...props}
        step={step}
        classes={classes}
        configDetail={configDetail}
        fileUpload={fileUpload}
      />
      <ConfigDetail
        {...props}
        step={step}
        classes={classes}
        fileUpload={fileUpload}
      />
      <FileUpload {...props} step={step} classes={classes} summary={summary} />
      <Summary {...props} step={step} classes={classes} />
    </div>
  );
}
