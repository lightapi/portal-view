import AddBoxIcon from '@mui/icons-material/AddBox';
import CircularProgress from '@mui/material/CircularProgress';
import TablePagination from '@mui/material/TablePagination';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableCell from '@mui/material/TableCell';
import TableRow from '@mui/material/TableRow';
import React, { useEffect, useState } from 'react';
import Cookies from 'universal-cookie';
import { useNavigate } from 'react-router-dom';
import { useUserState } from '../../contexts/UserContext';
import useDebounce from '../../hooks/useDebounce';
import useStyles from './styles';
import TableList from './TableList';

const getPaginatedData = (data, page, rowsPerPage) => {
    const startIndex = page * rowsPerPage;
    const endIndex = startIndex + rowsPerPage;
    return data.slice(startIndex, endIndex);
}

export default function RefTable(props) {
    const classes = useStyles();
    const [tableName, setTableName] = useState('');
    const debouncedTableName = useDebounce(tableName, 1000);
    const [tableDesc, setTableDesc] = useState('');
    const debouncedTableDesc = useDebounce(tableDesc, 1000);
    const [active, setActive] = useState('Y');
    const [editable, setEditable] = useState('Y');
    const [common, setCommon] = useState('Y');
    
    const handleTableNameChange = (event) => {
        setTableName(event.target.value);
    };

    const handleTableDescChange = (event) => {
        setTableDesc(event.target.value);
    };

    const handleActiveChange = (event) => {
        setActive(event.target.value);
    };

    const handleEditableChange = (event) => {
        setEditable(event.target.value);
    };

    const handleCommonChange = (event) => {
        setCommon(event.target.value);
    };

    const navigate = useNavigate();
    const { host } = useUserState();
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(25);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [total, setTotal] = useState(0);
    const [tables, setTables] = useState([]);

    const cmd = {
        host: 'lightapi.net',
        service: 'ref',
        action: 'getTable',
        version: '0.1.0',
        data: { 
            hostId: host,
            offset: page * rowsPerPage,
            limit: rowsPerPage,
            tableName: debouncedTableName,
            tableDesc: debouncedTableDesc,
            active,
            editable,
            common
        },
    };

    const url = '/portal/query?cmd=' + encodeURIComponent(JSON.stringify(cmd));

    // Fetch data from API or use data prop
    const fetchData = async (url, headers) => {
        try {
            setLoading(true);
            console.log("fetch data from API with cmd = ", cmd);
            const response = await fetch(url, { headers, credentials: 'include' });
            if (!response.ok) {
                const error = await response.json();
                setError(error.description);
                setTables([]);
            } else {
                const data = await response.json();
                setTables(data.tables);
                setTotal(data.total);
            }
        } catch (e) {
            console.log(e);
            setError(e);
            setTables([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const cookies = new Cookies();
        const headers = { 'X-CSRF-TOKEN': cookies.get('csrf') };
        // if data is passed, use the data. Otherwise fetch from the API
        if (props.data && props.data.tables) {
            console.log("fetch data from props");
            setTables(props.data.tables);
            setTotal(props.data.total);
        } else {
            fetchData(url, headers);
        }
    }, [page, rowsPerPage, props.data, debouncedTableName, debouncedTableDesc, active, editable, common]);

    const handleChangePage = (event, newPage) => {
        setPage(newPage);
    };

    const handleChangeRowsPerPage = (event) => {
        setRowsPerPage(+event.target.value);
        setPage(0);
    };

    const handleCreate = () => {
        navigate('/app/form/createRefTable');
    };

    let wait;
    if (loading) {
        wait = (
            <div>
                <CircularProgress />
            </div>
        );
    } else if (error) {
        wait = (
            <div>
                <pre>{JSON.stringify(error, null, 2)}</pre>
            </div>
        );
    } else {
        wait = (
            <div>
                <TableContainer component={Paper}>
                    <Table aria-label="collapsible table">
                        <TableHead>
                        <TableRow>
                            <TableCell align="left">Host Id</TableCell>
                            <TableCell align="left">Table Id</TableCell>
                            <TableCell align="left"><input type="text" placeholder="Table Name" value={tableName} onChange={handleTableNameChange} /></TableCell>
                            <TableCell align="left"><input type="text" placeholder="Table Desc" value={tableDesc} onChange={handleTableDescChange} /></TableCell>
                            <TableCell align="left">
                                <label htmlFor="active">Active:</label>
                                <select id="active" value={active} onChange={handleActiveChange}>
                                    <option value="Y">Y</option>
                                    <option value="N">N</option>
                                </select>
                            </TableCell>
                            <TableCell align="left">
                                <label htmlFor="editable">Editable:</label>
                                <select id="editable" value={editable} onChange={handleEditableChange}>
                                    <option value="Y">Y</option>
                                    <option value="N">N</option>
                                </select>
                            </TableCell>
                            <TableCell align="left">
                                <label htmlFor="common">Common:</label>
                                <select id="common" value={common} onChange={handleCommonChange}>
                                    <option value="Y">Y</option>
                                    <option value="N">N</option>
                                </select>
                            </TableCell>
                            <TableCell align="right">Value</TableCell>
                            <TableCell align="right">Update</TableCell>
                            <TableCell align="right">Delete</TableCell>
                        </TableRow>
                        </TableHead>

                        <TableList {...props} tables={getPaginatedData(tables, page, rowsPerPage)} />

                    </Table>
                </TableContainer>
                <TablePagination
                    rowsPerPageOptions={[10, 25, 100]}
                    component="div"
                    count={total}
                    rowsPerPage={rowsPerPage}
                    page={page}
                    onPageChange={handleChangePage}
                    onRowsPerPageChange={handleChangeRowsPerPage}
                />
                <AddBoxIcon onClick={() => handleCreate()} />
            </div>
        );
    }

    return <div className="App">{wait}</div>;
}
