import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useLocation } from 'react-router-dom';
import Button from '@mui/material/Button';
import { Box, Typography } from '@mui/material';
import { useDropzone } from 'react-dropzone';
import { SchemaForm, utils } from 'react-schema-form';
import { useSiteDispatch, useSiteState } from '../../contexts/SiteContext';
import forms from '../../data/Forms';

// Global spec variable used in the original file
var spec: any = null;

const baseStyle: React.CSSProperties = {
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

interface StepProps {
  step: number;
}

function Summary({ step }: StepProps) {
  if (step !== 4) {
    return null;
  }

  return <Box>Summary</Box>;
}

interface FileUploadProps extends StepProps {
  summary: () => void;
}

function FileUpload({ step }: FileUploadProps) {
  const [files, setFiles] = useState<File[]>();

  const onDrop = useCallback((acceptedFiles: File[]) => {
    acceptedFiles.forEach((file) => {
      if (acceptedFiles.length === 1 && file.name === 'openapi.yaml') {
        const fr = new FileReader();
        fr.onload = (e) => {
          // Process file content if needed
        };
        fr.readAsText(file);
      }
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
    <Box className="container">
      <Box {...getRootProps({ style })}>
        <input {...getInputProps()} />
        {isDragActive ? (
          <Typography>Drop the openapi.yaml here ...</Typography>
        ) : (
          <Typography>
            Drag 'n' drop the openapi.yaml here, or click to select the file
          </Typography>
        )}
      </Box>
    </Box>
  );
}

interface ConfigDetailProps extends StepProps {
  fileUpload: () => void;
}

function ConfigDetail({ step, fileUpload }: ConfigDetailProps) {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const [model, setModel] = useState({ ...useSiteState().configDetail });
  const [updated, setUpdated] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [configDetail, setConfigDetail] = useState<any>();
  let siteDispatch = useSiteDispatch();
  const mounted = useRef(false);

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
    } else {
      if (spec && !updated) {
        console.log('ConfigDetail is updated', spec);
        const domain =
          spec && spec.host ? spec.host.split('.').reverse().join('.') : '';
        let newConfigDetail = {
          name: spec && spec.name ? spec.name.toLowerCase() : null,
          version: spec && spec.version ? spec.version : null,
          style: spec && spec.style ? spec.style : null,
          groupId: domain,
          artifactId: spec && spec.name ? spec.name.toLowerCase() : null,
          rootPackage: domain,
          handlerPackage: domain + '.handler',
          modelPackage: domain + '.model',
        };
        setModel(newConfigDetail);
        setUpdated(true);
      }
    }
  }, [updated]);

  useEffect(() => {
    if (configDetail) {
      siteDispatch({ type: 'UPDATE_CONFIGDETAIL', configDetail: configDetail });
    }
  }, [configDetail, siteDispatch]);

  if (step !== 2) {
    return null;
  }

  let formData = forms['configDetailForm'];

  const onModelChange = (key: string, val: any, type: string) => {
    utils.selectOrSet(key, model, val, type);
    setModel({ ...model });
  };

  const onButtonClick = (item: any) => {
    let validationResult = utils.validateBySchema(formData.schema, model);
    if (!validationResult.valid) {
      setShowErrors(true);
    } else {
      setConfigDetail(model);
      if (item.action === 'upload') {
        fileUpload();
      }
    }
  };

  return (
    <Box>
      <Typography variant="h5" component="h2" gutterBottom>
        {formData.schema.title}
      </Typography>
      <SchemaForm
        schema={formData.schema}
        form={formData.form}
        model={model}
        showErrors={showErrors}
        onModelChange={onModelChange}
      />
      <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
        {formData.actions.map((item: any, index: number) => (
          <Button
            variant="contained"
            color="primary"
            key={index}
            onClick={() => onButtonClick(item)}
          >
            {item.title}
          </Button>
        ))}
      </Box>
    </Box>
  );
}

interface SpecDetailProps extends StepProps {
  fileUpload: () => void;
  configDetail: () => void;
}

function SpecDetail({ step, fileUpload, configDetail }: SpecDetailProps) {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  let initialStyle = searchParams.get('style');
  const [model, setModel] = useState({ ...useSiteState().specDetail, style: initialStyle });
  const [showErrors, setShowErrors] = useState(false);
  const [specDetail, setSpecDetail] = useState<any>();

  let siteDispatch = useSiteDispatch();

  useEffect(() => {
    if (specDetail) {
      siteDispatch({ type: 'UPDATE_SPECDETAIL', specDetail });
      spec = specDetail;
    }
  }, [specDetail, siteDispatch]);

  if (step !== 1) {
    return null;
  }

  let formData = forms['specDetailForm'];

  const onModelChange = (key: string, val: any, type: string) => {
    utils.selectOrSet(key, model, val, type);
    setModel({ ...model });
  };

  const onButtonClick = (item: any) => {
    let validationResult = utils.validateBySchema(formData.schema, model);
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

  return (
    <Box>
      <Typography variant="h5" component="h2" gutterBottom>
        {formData.schema.title}
      </Typography>
      <SchemaForm
        schema={formData.schema}
        form={formData.form}
        model={model}
        showErrors={showErrors}
        onModelChange={onModelChange}
      />
      <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
        {formData.actions.map((item: any, index: number) => (
          <Button
            variant="contained"
            color="primary"
            key={index}
            onClick={() => onButtonClick(item)}
          >
            {item.title}
          </Button>
        ))}
      </Box>
    </Box>
  );
}

export default function PublishApi() {
  const [step, setStep] = useState(1);

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
    <Box sx={{ p: 2 }}>
      <SpecDetail
        step={step}
        configDetail={configDetail}
        fileUpload={fileUpload}
      />
      <ConfigDetail
        step={step}
        fileUpload={fileUpload}
      />
      <FileUpload step={step} summary={summary} />
      <Summary step={step} />
    </Box>
  );
}
