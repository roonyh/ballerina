import React from 'react';
import Description from './Description';
import './Documentation.css';

const Documentation = ({docDetails}) => {
    const { title, description, parameters } = docDetails;
    return ( 
        <div className='documentation'>
            <div className='title'><b>{title}</b></div>
            <Description source={description} />
            { parameters.length > 0 && (
                <table className='parameters'>
                    <tr>
                        <th>Parameter Name</th>
                        <th>Data Type</th>
                        <th>Default Value</th>
                        <th>Description</th>
                    </tr>
                    {
                        parameters.map((param) => {
                            const { name, type, defaultValue, description } = param;
                            return (
                                <tr>
                                    <td>{ name }</td>
                                    <td>{ type }</td>
                                    <td>{ defaultValue }</td>
                                    <td>{ <Description source={description} /> }</td>
                                </tr>
                            );
                        })
                    }
                </table>
            )}
        </div>
    );
};

export default Documentation;
