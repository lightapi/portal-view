import {
  Box, Button, Card, CardActions, CardContent, Chip, Divider, Stack, Tooltip, Typography,
} from '@mui/material';
import DetailsIcon from '@mui/icons-material/Details';
import MemoryIcon from '@mui/icons-material/Memory';
import type { LlmModelCatalogItem, LlmModelCatalogViewMode } from '../hooks/useLlmModelCatalog';
import { formatTaxonomyLabel } from '../hooks/useApiCatalog';

type Props = {
  model: LlmModelCatalogItem;
  viewMode: LlmModelCatalogViewMode;
  onDetails: (model: LlmModelCatalogItem) => void;
};

function TaxonomyChips({values, limit, emptyLabel}:{values?:string[];limit:number;emptyLabel:string}) {
  if (!values?.length) return <Chip size="small" variant="outlined" label={emptyLabel}/>;
  const visible = values.slice(0,limit);
  return <>{visible.map(value => <Chip key={value} size="small" variant="outlined" label={formatTaxonomyLabel(value)}/>)}
    {values.length > limit && <Chip size="small" label={`+${values.length-limit}`}/>}</>;
}

function tokenLabel(value?: number) {
  return value == null ? 'Not specified' : new Intl.NumberFormat().format(value);
}

export default function LlmModelCatalogCard({model,viewMode,onDetails}:Props) {
  const title = model.physicalModelId || model.modelId;
  return <Card variant="outlined" sx={{height:'100%',borderRadius:1,display:'flex',flexDirection:viewMode==='list'?{xs:'column',md:'row'}:'column'}}>
    <CardContent sx={{flex:1,minWidth:0,pb:1.5}}><Stack spacing={1.5}>
      <Box sx={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:1.5}}>
        <Box sx={{minWidth:0}}><Tooltip title={title}><Typography variant="h6" sx={{fontSize:18,lineHeight:1.25,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{title}</Typography></Tooltip>
          <Typography variant="caption" color="text.secondary" sx={{display:'block',overflowWrap:'anywhere'}}>{model.modelId}</Typography>
        </Box>
        <Chip size="small" color={model.active?'success':'default'} variant="outlined" label={model.active?'Active':'Inactive'}/>
      </Box>
      <Typography variant="body2" color="text.secondary">{model.providerType} / {model.modelFamily}{model.modelVersion?` / ${model.modelVersion}`:''}</Typography>
      <Stack direction="row" gap={0.75} flexWrap="wrap">
        <Chip size="small" color={model.lifecycleStatus==='ACTIVE'?'primary':'default'} variant="outlined" label={formatTaxonomyLabel(model.lifecycleStatus || 'Unknown lifecycle')}/>
        <Chip size="small" icon={<MemoryIcon fontSize="small"/>} variant="outlined" label={`${tokenLabel(model.contextTokenLimit)} context`}/>
        <Chip size="small" variant="outlined" label={`${tokenLabel(model.outputTokenLimit)} output`}/>
      </Stack>
      <Stack direction="row" gap={0.75} flexWrap="wrap"><TaxonomyChips values={model.operations} limit={4} emptyLabel="No operations"/></Stack>
      <Stack direction="row" gap={0.75} flexWrap="wrap"><TaxonomyChips values={model.modalities} limit={4} emptyLabel="No modalities"/></Stack>
      <Stack direction="row" gap={0.75} flexWrap="wrap"><TaxonomyChips values={model.categories} limit={3} emptyLabel="Uncategorized"/></Stack>
      <Stack direction="row" gap={0.75} flexWrap="wrap"><TaxonomyChips values={model.tags} limit={5} emptyLabel="No tags"/></Stack>
    </Stack></CardContent>
    <Divider flexItem orientation={viewMode==='list'?'vertical':'horizontal'}/>
    <CardActions sx={{p:1.5,justifyContent:'flex-end',minWidth:viewMode==='list'?{md:140}:undefined}}>
      <Button size="small" startIcon={<DetailsIcon/>} onClick={() => onDetails(model)}>Details</Button>
    </CardActions>
  </Card>;
}
