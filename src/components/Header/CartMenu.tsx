import { DeleteForever, ShoppingCart } from '@mui/icons-material';
import {
  Box,
  Button,
  CircularProgress,
  Divider,
  FormControl,
  IconButton,
  InputLabel,
  Menu,
  MenuItem,
  Paper,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  useTheme,
} from '@mui/material';
import DropIn from 'braintree-web-drop-in-react';
import React, { useEffect, useState } from 'react';
import { SchemaForm, utils } from 'react-schema-form';
import { useNavigate } from "react-router-dom";
import { useSiteDispatch, useSiteState } from '../../contexts/SiteContext';
import { useUserState } from '../../contexts/UserContext';
import forms from '../../data/Forms';
import { useApiGet } from '../../hooks/useApiGet';
import { useApiPost } from '../../hooks/useApiPost';
import { Badge, Typography } from '../Wrappers/Wrappers';

function Braintree({ step, completePayment, proceedPayment, summarizeOrder }: any) {
  const [instance, setInstance] = useState<any>();
  const [nonce, setNonce] = useState<any>();
  const [clientToken, setClientToken] = useState<string | null>(null);
  const { owner, payment }: any = useSiteState();

  const cmd = {
    host: 'lightapi.net',
    service: 'user',
    action: 'getClientToken',
    version: '0.1.0',
    data: { userId: owner, merchantId: payment?.merchantId },
  };
  const url = '/portal/query?cmd=' + encodeURIComponent(JSON.stringify(cmd));
  const headers = {};
  const callback = (data: any) => {
    setClientToken(data.clientToken);
  };
  useApiGet({ url, headers, callback });

  const onBuy = async () => {
    const { nonce } = await instance.requestPaymentMethod();
    setNonce(nonce);
    completePayment();
  };

  if (step !== 5) {
    return null;
  }

  if (!clientToken) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
        <CircularProgress />
      </Box>
    );
  } else {
    return (
      <Box sx={{ p: 2 }}>
        <DropIn
          options={{ authorization: clientToken }}
          onInstance={(inst) => setInstance(inst)}
        />
        <Button
          variant="contained"
          sx={{ mb: 1, width: '100%' }}
          color="primary"
          onClick={() => proceedPayment()}
        >
          PAYMENT OPTIONS
        </Button>
        {!nonce && (
          <Button
            variant="contained"
            sx={{ mb: 1, width: '100%' }}
            color="primary"
            onClick={() => onBuy()}
          >
            BUY
          </Button>
        )}
        {nonce && (
          <Button
            variant="contained"
            sx={{ mb: 1, width: '100%' }}
            color="primary"
            onClick={() => summarizeOrder()}
          >
            SUMMARY
          </Button>
        )}
      </Box>
    );
  }
}

function Summary({ step, cleanCart }: any) {
  const { owner, cart, delivery, payment }: any = useSiteState();
  const { email, userId }: any = useUserState();

  const body = {
    host: 'lightapi.net',
    service: 'user',
    action: 'createOrder',
    version: '0.1.0',
    data: {
      userId: owner,
      order: {
        merchantUserId: owner,
        customerEmail: email,
        customerUserId: userId,
        delivery: delivery,
        items: cart,
        payment: payment,
      },
    },
  };
  const url = '/portal/command';
  const headers = {};
  const { isLoading, data, error }: any = useApiPost({ url, headers, body });

  if (step !== 4) {
    return null;
  }

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 2, textAlign: 'center' }}>
      <Typography variant="h5" gutterBottom>Order Summary</Typography>
      {data && (
        <>
          <Typography>Order Id: {data.orderId}</Typography>
          <Typography>Pass Code: {data.passCode}</Typography>
        </>
      )}
      {error && <Typography color="error">{error}</Typography>}
      <Button
        variant="contained"
        sx={{ mt: 2, width: '100%' }}
        color="primary"
        onClick={() => cleanCart()}
      >
        Close
      </Button>
    </Box>
  );
}

function Payment({
  step,
  summarizeOrder,
  startBraintree,
  completePayment,
  selectDelivery,
}: any) {
  const { owner }: any = useSiteState();
  const [payment, setPayment] = useState<any>({ method: '' });
  const siteDispatch: any = useSiteDispatch();

  const cmd = {
    host: 'lightapi.net',
    service: 'user',
    action: 'getPaymentById',
    version: '0.1.0',
    data: { userId: owner },
  };

  const url = '/portal/query?cmd=' + encodeURIComponent(JSON.stringify(cmd));
  const headers = {};
  const { isLoading, data, error }: any = useApiGet({ url, headers, callback: () => {} });

  if (step !== 3) {
    return null;
  }

  const onPayment = () => {
    switch (payment.method) {
      case 'OnPickup':
        completePayment();
        summarizeOrder();
        break;
      case 'Braintree':
        startBraintree();
        break;
      default:
        window.alert('Please select a payment method.');
        break;
    }
  };

  const onChange = (event: any, child: any) => {
    const method = event.target.value;
    switch (method) {
      case 'OnPickup':
        setPayment({ method: 'OnPickup' });
        siteDispatch({
          type: 'UPDATE_PAYMENT',
          payment: { method: 'OnPickup' },
        });
        break;
      case 'Braintree':
        setPayment({
          method: 'Braintree',
          merchantId: data[child.key].merchantId,
        });
        siteDispatch({
          type: 'UPDATE_PAYMENT',
          payment: {
            method: 'Braintree',
            merchantId: data[child.key].merchantId,
          },
        });
        break;
    }
  };

  if (isLoading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}><CircularProgress /></Box>;
  } else if (data) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography variant="h5" gutterBottom>Payment Option</Typography>
        <FormControl fullWidth sx={{ mb: 2 }}>
          <InputLabel id="payment-method-label">Method</InputLabel>
          <Select
            labelId="payment-method-label"
            id="payment-method-select"
            value={payment.method}
            onChange={onChange}
            label="Method"
          >
            {data.map((p: any, index: number) => (
              <MenuItem key={index} value={p.method}>
                {p.method + (p.sandbox ? '-Sandbox' : '')}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="contained"
            fullWidth
            onClick={() => selectDelivery()}
          >
            Delivery
          </Button>
          <Button
            variant="contained"
            fullWidth
            color="primary"
            onClick={() => onPayment()}
          >
            Payment
          </Button>
        </Box>
      </Box>
    );
  } else {
    return <Box sx={{ p: 2 }}><Typography color="error">{error}</Typography></Box>;
  }
}

function Delivery({ step, reviewCart, proceedPayment }: any) {
  const [model, setModel] = useState({ ...(useSiteState() as any).delivery });
  const [showErrors, setShowErrors] = useState(false);
  const [delivery, setDelivery] = useState<any>();
  const siteDispatch: any = useSiteDispatch();

  useEffect(() => {
    if (delivery) {
      siteDispatch({ type: 'UPDATE_DELIVERY', delivery: delivery });
    }
  }, [delivery, siteDispatch]);

  if (step !== 2) {
    return null;
  }

  const formData = forms['pickupForm'];

  const onModelChange = (key: any, val: any, type: any) => {
    utils.selectOrSet(key, model, val, type);
    setModel({ ...model });
  };

  const onButtonClick = (item: any) => {
    if (item.action === 'cart') {
      reviewCart();
    } else {
      const validationResult = (utils as any).validateBySchema(formData.schema, model);
      if (!validationResult.valid) {
        setShowErrors(true);
      } else {
        setDelivery(model);
        proceedPayment();
      }
    }
  };

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h5" gutterBottom>{formData.schema.title}</Typography>
      <SchemaForm
        schema={formData.schema}
        form={formData.form}
        model={model}
        showErrors={showErrors}
        onModelChange={onModelChange}
      />
      <Box sx={{ mt: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        {formData.actions.map((item: any, index: number) => (
          <Button
            variant="contained"
            color="primary"
            key={index}
            onClick={() => onButtonClick(item)}
            sx={{ flexGrow: 1 }}
          >
            {item.title}
          </Button>
        ))}
      </Box>
    </Box>
  );
}

const CartTotal = ({
  step,
  cart,
  deleteFromCart,
  selectDelivery,
  closeCart,
  taxRate,
}: any) => {
  const ccyFormat = (num: number) => `${num.toFixed(2)}`;

  const subtotal = (items: any[]) => {
    let total = 0;
    for (var i = 0; i < items.length; i++) {
      total += items[i].price * parseInt(items[i].quantity);
    }
    return total;
  };

  const invoiceSubtotal = subtotal(cart);
  const invoiceTaxes = (taxRate * invoiceSubtotal) / 100;
  const invoiceTotal = invoiceSubtotal + invoiceTaxes;

  if (step !== 1) {
    return null;
  }

  if (cart && cart.length > 0) {
    return (
      <Box sx={{ p: 2 }}>
        <TableContainer component={Paper} sx={{ mb: 2 }}>
          <Table sx={{ minWidth: 300 }} aria-label="spanning table">
            <TableHead>
              <TableRow>
                <TableCell></TableCell>
                <TableCell align="left">Name/Price</TableCell>
                <TableCell align="right">Qty./Sum</TableCell>
                <TableCell align="right"></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {cart.map((row: any) => (
                <TableRow key={row.sku}>
                  <TableCell>
                    <Box component="img" src={row.image} sx={{ width: 48, height: 48 }} />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{row.name}</Typography>
                    <Divider />
                    <Typography variant="body2">{row.price}</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{row.quantity}</Typography>
                    <Divider />
                    <Typography variant="body2">{row.quantity * row.price}</Typography>
                  </TableCell>
                  <TableCell>
                    <DeleteForever
                      onClick={() => deleteFromCart(row.sku)}
                      sx={{ cursor: 'pointer' }}
                    />
                  </TableCell>
                </TableRow>
              ))}
              <TableRow>
                <TableCell rowSpan={3} />
                <TableCell>Subtotal</TableCell>
                <TableCell align="left">{ccyFormat(invoiceSubtotal)}</TableCell>
                <TableCell />
              </TableRow>
              <TableRow>
                <TableCell>Tax - {`${taxRate.toFixed(0)} %`}</TableCell>
                <TableCell align="left">{ccyFormat(invoiceTaxes)}</TableCell>
                <TableCell />
              </TableRow>
              <TableRow>
                <TableCell>Total</TableCell>
                <TableCell align="left">{ccyFormat(invoiceTotal)}</TableCell>
                <TableCell />
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="contained"
            fullWidth
            onClick={() => closeCart()}
          >
            Continue Shopping
          </Button>
          <Button
            variant="contained"
            fullWidth
            color="primary"
            onClick={() => selectDelivery()}
          >
            CHECKOUT
          </Button>
        </Box>
      </Box>
    );
  } else {
    return <Box sx={{ p: 2, textAlign: 'center' }}>Empty Cart!</Box>;
  }
};

export default function CartMenu() {
  const [cartMenu, setCartMenu] = useState<null | HTMLElement>(null);
  const [step, setStep] = useState(1);
  const [completedPayment, setCompletedPayment] = useState(false);

  const siteDispatch: any = useSiteDispatch();
  const { cart, menu, site }: any = useSiteState();

  const deleteFromCart = (sku: string) => {
    const newCart = cart.filter((item: any) => item.sku !== sku);
    siteDispatch({ type: 'UPDATE_CART', cart: newCart });
  };

  const taxRate = site?.catalog?.taxRate || 0;

  const selectDelivery = () => setStep(2);
  const reviewCart = () => setStep(1);
  const proceedPayment = () => setStep(3);
  const summarizeOrder = () => setStep(4);
  const startBraintree = () => setStep(5);
  const closeCart = () => setCartMenu(null);
  const cleanCart = () => {
    siteDispatch({ type: 'UPDATE_CART', cart: [] });
    setCartMenu(null);
  };
  const completePayment = () => setCompletedPayment(true);

  if (menu !== 'catalog') return null;

  return (
    <>
      <IconButton
        aria-haspopup="true"
        color="inherit"
        onClick={(e) => {
          setCartMenu(e.currentTarget);
          setStep(1);
        }}
        size="large"
        sx={{ ml: 2, p: 0.5 }}
      >
        <Badge
          badgeContent={cart?.length > 0 ? cart.length : null}
          color="secondary"
        >
          <ShoppingCart sx={{ fontSize: 28 }} />
        </Badge>
      </IconButton>
      <Menu
        id="cart-menu"
        open={Boolean(cartMenu)}
        anchorEl={cartMenu}
        onClose={() => setCartMenu(null)}
        sx={{ mt: 7 }}
        PaperProps={{ sx: { minWidth: 320, maxWidth: 400 } }}
        disableAutoFocusItem
      >
        <Box sx={{ maxHeight: '80vh', overflowY: 'auto' }}>
          <CartTotal
            step={step}
            taxRate={taxRate}
            cart={cart}
            deleteFromCart={deleteFromCart}
            selectDelivery={selectDelivery}
            closeCart={closeCart}
          />
          <Delivery
            step={step}
            reviewCart={reviewCart}
            proceedPayment={proceedPayment}
          />
          <Payment
            step={step}
            selectDelivery={selectDelivery}
            summarizeOrder={summarizeOrder}
            startBraintree={startBraintree}
            completePayment={completePayment}
          />
          {step === 5 && (
            <Braintree
              step={step}
              proceedPayment={proceedPayment}
              completePayment={completePayment}
              summarizeOrder={summarizeOrder}
            />
          )}
          {completedPayment && (
            <Summary
              step={step}
              cleanCart={cleanCart}
            />
          )}
        </Box>
      </Menu>
    </>
  );
}
