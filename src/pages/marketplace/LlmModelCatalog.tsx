import { useCallback, useMemo, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Alert, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
  Pagination, Stack, Typography,
} from '@mui/material';
import AddBoxIcon from '@mui/icons-material/AddBox';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import { useUserState } from '../../contexts/UserContext';
import { hasAnyRole } from '../../utils/ownershipScope';
import LlmModelCatalogCard from './components/LlmModelCatalogCard';
import LlmModelCatalogFilters from './components/LlmModelCatalogFilters';
import {
  type LlmModelCatalogItem, type LlmModelCatalogParams, type LlmModelCatalogSortField,
  type LlmModelCatalogSortOrder, type LlmModelCatalogStatus, type LlmModelCatalogViewMode,
  type LlmModelTagMatchMode, parseLlmModelCatalogParams, useLlmModelCatalog,
} from './hooks/useLlmModelCatalog';

function setRepeatedParam(params:URLSearchParams,key:string,values:string[]) {
  params.delete(key);
  values.forEach(value => params.append(key,value));
}

function toggleValue(values:string[],value:string) {
  return values.includes(value) ? values.filter(item => item!==value) : [...values,value];
}

function updateSearchParams(current:URLSearchParams,patch:Partial<LlmModelCatalogParams>,resetPage=true) {
  const next = new URLSearchParams(current);
  if (patch.q !== undefined) patch.q.trim()?next.set('q',patch.q):next.delete('q');
  if (patch.categories !== undefined) setRepeatedParam(next,'category',patch.categories);
  if (patch.tags !== undefined) setRepeatedParam(next,'tag',patch.tags);
  if (patch.tagMatch !== undefined) patch.tagMatch==='all'?next.delete('tagMatch'):next.set('tagMatch',patch.tagMatch);
  if (patch.status !== undefined) patch.status==='active'?next.delete('status'):next.set('status',patch.status);
  if (patch.pageSize !== undefined) next.set('pageSize',String(patch.pageSize));
  if (patch.sort !== undefined) patch.sort==='physicalModelId'?next.delete('sort'):next.set('sort',patch.sort);
  if (patch.order !== undefined) patch.order==='asc'?next.delete('order'):next.set('order',patch.order);
  if (patch.view !== undefined) patch.view==='grid'?next.delete('view'):next.set('view',patch.view);
  if (patch.page !== undefined) patch.page<=1?next.delete('page'):next.set('page',String(patch.page));
  else if (resetPage) next.delete('page');
  return next;
}

export default function LlmModelCatalog() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams,setSearchParams] = useSearchParams();
  const {roles} = useUserState() as {roles?:string|null};
  const catalogAdmin = hasAnyRole(roles, ['admin']);
  const params = useMemo(() => parseLlmModelCatalogParams(searchParams),[searchParams]);
  const [detailModel,setDetailModel] = useState<LlmModelCatalogItem|null>(null);
  const {categories,tagGroups,models,total,isLoadingOptions,isLoadingModels,error,taxonomyFiltersActive} = useLlmModelCatalog({params});
  const updateParams = useCallback((patch:Partial<LlmModelCatalogParams>,resetPage=true) => {
    setSearchParams(updateSearchParams(searchParams,patch,resetPage));
  },[searchParams,setSearchParams]);
  const totalPages = Math.max(1,Math.ceil(total/params.pageSize));
  const isLoading = isLoadingOptions || isLoadingModels;

  return <Box>
    <Stack direction={{xs:'column',md:'row'}} spacing={2} alignItems={{xs:'stretch',md:'center'}} justifyContent="space-between" sx={{mb:2}}>
      <Box><Typography variant="h5" sx={{fontWeight:700}}>LLM Model Catalog</Typography>
        <Typography variant="body2" color="text.secondary">{total} {total===1?'model':'models'} found{taxonomyFiltersActive?' for the selected taxonomy filters':''}</Typography>
      </Box>
      {catalogAdmin && <Stack direction="row" spacing={1} flexWrap="wrap" justifyContent={{xs:'flex-start',md:'flex-end'}}>
        <Button variant="outlined" startIcon={<AdminPanelSettingsIcon/>} onClick={() => navigate('/app/genai/LlmModelControlPlane')}>LLM Models Admin</Button>
        <Button variant="contained" startIcon={<AddBoxIcon/>} onClick={() => navigate('/app/form/createLlmModel',{state:{data:{globalFlag:true},source:location.pathname}})}>Create LLM Model</Button>
      </Stack>}
    </Stack>
    {error && <Alert severity="error" sx={{mb:2}}>{error}</Alert>}
    <LlmModelCatalogFilters params={params} categories={categories} tagGroups={tagGroups} isLoading={isLoading}
      onSearchChange={q=>updateParams({q})}
      onCategoryToggle={category=>updateParams({categories:toggleValue(params.categories,category)})}
      onTagToggle={tag=>updateParams({tags:toggleValue(params.tags,tag)})}
      onTagMatchChange={(tagMatch:LlmModelTagMatchMode)=>updateParams({tagMatch})}
      onStatusChange={(status:LlmModelCatalogStatus)=>updateParams({status})}
      onSortChange={(sort:LlmModelCatalogSortField)=>updateParams({sort})}
      onOrderChange={(order:LlmModelCatalogSortOrder)=>updateParams({order})}
      onViewChange={(view:LlmModelCatalogViewMode)=>updateParams({view},false)}
      onClear={()=>updateParams({q:'',categories:[],tags:[],tagMatch:'all',status:'active'})}/>
    <Box sx={{mt:2,minHeight:220}}>{isLoadingModels?
      <Stack alignItems="center" justifyContent="center" sx={{py:6}}><CircularProgress/></Stack>:
      models.length===0?<Alert severity="info">No LLM models match the current catalog filters.</Alert>:
      <Box sx={{display:'grid',gridTemplateColumns:params.view==='list'?'1fr':'repeat(auto-fill, minmax(min(100%, 320px), 1fr))',gap:2}}>
        {models.map(model => <LlmModelCatalogCard key={model.modelId} model={model} viewMode={params.view} onDetails={setDetailModel}/>)}</Box>}
    </Box>
    <Stack direction={{xs:'column',sm:'row'}} spacing={1.5} alignItems="center" justifyContent="space-between" sx={{mt:2}}>
      <Typography variant="body2" color="text.secondary">Page {Math.min(params.page,totalPages)} of {totalPages}</Typography>
      <Pagination page={Math.min(params.page,totalPages)} count={totalPages} color="primary" onChange={(_,page)=>updateParams({page},false)}/>
      <Stack direction="row" spacing={0.75} alignItems="center"><Typography variant="body2" color="text.secondary">Page size</Typography>
        {[12,24,48].map(size => <Button key={size} size="small" variant={params.pageSize===size?'contained':'outlined'} onClick={()=>updateParams({pageSize:size})}>{size}</Button>)}
      </Stack>
    </Stack>
    <Dialog open={detailModel!==null} onClose={()=>setDetailModel(null)} fullWidth maxWidth="md">
      <DialogTitle>{detailModel?.physicalModelId || 'LLM model details'}</DialogTitle>
      <DialogContent><Typography component="pre" variant="body2" sx={{whiteSpace:'pre-wrap',overflowWrap:'anywhere',m:0}}>{detailModel?JSON.stringify(detailModel,null,2):''}</Typography></DialogContent>
      <DialogActions><Button onClick={()=>setDetailModel(null)}>Close</Button></DialogActions>
    </Dialog>
  </Box>;
}
