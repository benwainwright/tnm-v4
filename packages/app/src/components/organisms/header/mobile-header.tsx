import styled from '@emotion/styled';
import { FC, Fragment } from 'react';

import { Button } from '../../atoms';

const StyledMenuIcon = styled.img`
  width: 40px;
  height: 40px;
`;
const MenuButtonContainerLeft = styled('div')`
  margin: 24px 0;
  width: 200px;
  text-align: left;
`;

const MenuButtonContainerRight = styled('div')`
  margin: 24px 0;
  width: 200px;
  text-align: right;
`;

const StyledTnmLogo = styled.img`
  flex-grow: 100;
  margin: 14px 0;
`;

const MobileHeader: FC = () => (
  <Fragment>
    <MenuButtonContainerLeft>
      <StyledMenuIcon src="/images/icons/menu.svg" />
    </MenuButtonContainerLeft>
    <StyledTnmLogo src="/images/icons/tnm-n-logo.inline.svg" />
    <MenuButtonContainerRight>
      <Button primary>Get Started</Button>
    </MenuButtonContainerRight>
  </Fragment>
);

export default MobileHeader;
